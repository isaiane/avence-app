import { prisma } from "@/server/infra/db/prisma";
import { ensureB2BConversation } from "@/server/dispatcher/ensure-b2b-conversation";
import { enqueueB2BMessageJob } from "@/server/agent-jobs/b2b";

export async function dispatchB2BInbound(params: {
  phoneNumberId: string;
  meiWaId: string | undefined;
  text: string | undefined;
  providerMessageId: string;
}) {
  const { phoneNumberId, meiWaId, text, providerMessageId } = params;
  if (!meiWaId) return { ok: false as const, reason: "Missing fromWaId" };

  const conv = await ensureB2BConversation({ phoneNumberId, meiWaId });

  const job = await enqueueB2BMessageJob({
    providerMessageId,
    phoneNumberId,
    conversationId: conv.id,
    fromWaId: meiWaId,
    text,
  });

  return { ok: true as const, jobId: job.id };
}


