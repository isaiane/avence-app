import { NextResponse } from "next/server";
import { prisma } from "@/server/infra/db/prisma";
import { resolveDomainByPhoneNumberId } from "@/server/routing/resolve-domain";
import { normalizeWhatsAppWebhookPayload } from "@/server/entrypoints/whatsapp/normalize";
import { verifyWhatsAppSignature } from "@/server/entrypoints/whatsapp/signature";

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

  const normalized = normalizeWhatsAppWebhookPayload(payload as any);
  if (normalized.length === 0) {
    await prisma.auditEvent.create({
      data: {
        eventType: "WHATSAPP_WEBHOOK_IGNORED",
        domain: "UNKNOWN",
        payload: { reason: "No messages found", hasEntry: !!(payload as any)?.entry },
      },
    });
    return NextResponse.json({ success: true, data: null, error: null }, { status: 200 });
  }

  // All messages in a webhook share the same phone_number_id (in practice).
  const phoneNumberId = normalized[0].phoneNumberId;
  const resolved = await resolveDomainByPhoneNumberId(phoneNumberId);

  // Persist messages idempotently.
  // We do per-message writes to keep behavior obvious for MVP.
  for (const msg of normalized) {
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
    } catch (e: any) {
      // Unique constraint -> duplicate delivery (idempotency).
      // Prisma error code for unique constraint: P2002
      if (e?.code !== "P2002") {
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
  }

  await prisma.auditEvent.create({
    data: {
      eventType: "WHATSAPP_WEBHOOK_RECEIVED",
      domain: resolved.domain,
      businessId: resolved.businessId ?? undefined,
      phoneNumberId,
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


