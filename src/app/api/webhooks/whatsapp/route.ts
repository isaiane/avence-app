import { NextResponse } from "next/server";
import { prisma } from "@/server/infra/db/prisma";
import { resolveDomainByPhoneNumberId } from "@/server/routing/resolve-domain";
import { normalizeWhatsAppWebhookPayload } from "@/server/entrypoints/whatsapp/normalize";
import { verifyWhatsAppSignature } from "@/server/entrypoints/whatsapp/signature";
import { dispatchB2BInbound } from "@/server/dispatcher/b2b-dispatch";
import { ensureB2BConversation } from "@/server/dispatcher/ensure-b2b-conversation";

function isMissingTableError(e: any): boolean {
  return e?.code === "P2021" || String(e?.message ?? "").includes("does not exist");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const ok =
    mode === "subscribe" &&
    !!expectedToken &&
    token === expectedToken &&
    typeof challenge === "string";

  if (!ok) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, { status: 200 });
}

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());

  const signatureCheck = verifyWhatsAppSignature({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature-256"),
    appSecret: process.env.WHATSAPP_APP_SECRET,
  });

  if (!signatureCheck.ok) {
    // Invalid signature must not be accepted.
    return NextResponse.json(
      { success: false, data: null, error: signatureCheck.reason },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    // Signature is valid but payload isn't parseable; don't force retries.
    await prisma.auditEvent.create({
      data: {
        eventType: "WHATSAPP_WEBHOOK_INVALID_JSON",
        domain: "UNKNOWN",
        payload: { rawBody: rawBody.toString("utf8").slice(0, 2000) },
      },
    });
    return NextResponse.json({ success: true, data: null, error: null }, { status: 200 });
  }

  const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberIdFromPayload: string | undefined = value?.metadata?.phone_number_id;
  const statusCount: number = Array.isArray(value?.statuses) ? value.statuses.length : 0;
  const messageCount: number = Array.isArray(value?.messages) ? value.messages.length : 0;

  const normalized = normalizeWhatsAppWebhookPayload(payload as any);
  if (normalized.length === 0) {
    // Common case: WhatsApp sends "statuses" webhooks (delivered/read/etc) without messages.
    // We should ACK with 200 to avoid retries, but not pollute audit logs as "ignored".
    if (phoneNumberIdFromPayload && statusCount > 0 && messageCount === 0) {
      const resolved = await resolveDomainByPhoneNumberId(phoneNumberIdFromPayload);
      await prisma.auditEvent.create({
        data: {
          eventType: "WHATSAPP_WEBHOOK_STATUS",
          domain: resolved.domain,
          businessId: resolved.businessId ?? undefined,
          phoneNumberId: phoneNumberIdFromPayload,
          payload: {
            statusCount,
            // keep minimal info; raw payload already exists in provider systems
            sampleStatusIds: (value?.statuses ?? []).slice(0, 5).map((s: any) => s?.id).filter(Boolean),
          },
        },
      });
      return NextResponse.json({ success: true, data: null, error: null }, { status: 200 });
    }

    await prisma.auditEvent.create({
      data: {
        eventType: "WHATSAPP_WEBHOOK_IGNORED",
        domain: "UNKNOWN",
        payload: {
          reason: "No messages found",
          hasEntry: !!(payload as any)?.entry,
          phoneNumberId: phoneNumberIdFromPayload ?? null,
          messageCount,
          statusCount,
        },
      },
    });
    return NextResponse.json({ success: true, data: null, error: null }, { status: 200 });
  }

  // All messages in a webhook share the same phone_number_id (in practice).
  const phoneNumberId = normalized[0].phoneNumberId;
  const resolved = await resolveDomainByPhoneNumberId(phoneNumberId);
  const meiWaId = normalized[0].fromWaId;

  // For B2B, we treat Conversation as canonical and start it at webhook ingest time.
  // This lets WHATSAPP_WEBHOOK_RECEIVED be correlated to the conversation.
  const conversation =
    resolved.domain === "B2B" && meiWaId
      ? await ensureB2BConversation({ phoneNumberId, meiWaId })
      : null;

  // Persist messages idempotently.
  // We do per-message writes to keep behavior obvious for MVP.
  let fatalDbError: { message: string } | null = null;
  for (const msg of normalized) {
    let isNewMessage = false;
    try {
      await prisma.inboundMessage.create({
        data: {
          providerMessageId: msg.providerMessageId,
          phoneNumberId: msg.phoneNumberId,
          fromWaId: msg.fromWaId,
          messageType: msg.messageType,
          textBody: msg.textBody,
          providerTimestamp: msg.providerTimestamp,
          payload: msg.raw as any,
        },
      });
      isNewMessage = true;
    } catch (e: any) {
      // Unique constraint -> duplicate delivery (idempotency).
      // Prisma error code for unique constraint: P2002
      if (e?.code !== "P2002") {
        if (isMissingTableError(e)) {
          fatalDbError = {
            message:
              "DB schema missing (tables do not exist). Run Prisma migrations against the DATABASE_URL in use by the server.",
          };
          break;
        }
        await prisma.auditEvent.create({
          data: {
            eventType: "WHATSAPP_INBOUND_PERSIST_ERROR",
            domain: resolved.domain,
            businessId: resolved.businessId ?? undefined,
            phoneNumberId,
            payload: { error: String(e), providerMessageId: msg.providerMessageId },
          },
        });
      }
    }

    // Dispatcher (MVP): only for *new* messages.
    if (isNewMessage && resolved.domain === "B2B") {
      // IMPORTANT: don't block the WhatsApp webhook response on agent dispatch.
      // In dev, first request can be slow due to compilation; in prod, we still want fast ACKs.
      // This is best-effort in serverless; long-term we should move to a proper queue/outbox.
      void dispatchB2BInbound({
        phoneNumberId,
        meiWaId: msg.fromWaId,
        text: msg.textBody,
        providerMessageId: msg.providerMessageId,
      }).catch(async (e) => {
        try {
          await prisma.auditEvent.create({
            data: {
              eventType: "B2B_DISPATCH_ERROR",
              domain: "B2B",
              phoneNumberId,
              payload: {
                providerMessageId: msg.providerMessageId,
                error: String(e),
              },
            },
          });
        } catch {
          // ignore (e.g. DB not migrated yet)
        }
      });
    }
  }

  if (fatalDbError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          message: fatalDbError.message,
          hint: "Run: npm run prisma:generate && npm run prisma:migrate (with DATABASE_URL pointing to the correct DB).",
        },
      },
      { status: 500 },
    );
  }

  await prisma.auditEvent.create({
    data: {
      eventType: "WHATSAPP_WEBHOOK_RECEIVED",
      domain: resolved.domain,
      businessId: resolved.businessId ?? undefined,
      phoneNumberId,
      conversationId: conversation?.id,
      payload: {
        messageCount: normalized.length,
        providerMessageIds: normalized.map((m) => m.providerMessageId),
      },
    },
  });

  // TODO (Fase 2+): dispatch para pipeline de domínio (B2B/B2C) e tools MCP.
  return NextResponse.json(
    {
      success: true,
      data: { domain: resolved.domain, businessId: resolved.businessId, phoneNumberId },
      error: null,
    },
    { status: 200 },
  );
}


