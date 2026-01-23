import { prisma } from "@/server/infra/db/prisma";
import { runB2BAgent } from "@/server/agent/b2b/run-b2b-agent";
import { ensureB2BConversation } from "@/server/dispatcher/ensure-b2b-conversation";

export async function dispatchB2BInbound(params: {
  phoneNumberId: string;
  meiWaId: string | undefined;
  text: string | undefined;
  providerMessageId: string;
}) {
  const { phoneNumberId, meiWaId, text, providerMessageId } = params;
  if (!meiWaId) return { ok: false as const, reason: "Missing fromWaId" };

  const conv = await ensureB2BConversation({ phoneNumberId, meiWaId });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_DISPATCH_START",
      domain: "B2B",
      businessId: conv.businessId ?? undefined,
      phoneNumberId,
      conversationId: conv.id,
      payload: { providerMessageId },
    },
  });

  const result = await runB2BAgent({
    phoneNumberId,
    conversationId: conv.id,
    meiWaId,
    text,
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_DISPATCH_END",
      domain: "B2B",
      businessId: result.businessId ?? undefined,
      phoneNumberId,
      conversationId: conv.id,
      payload: { providerMessageId, action: result.action },
    },
  });

  return { ok: true as const };
}


