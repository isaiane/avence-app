import { prisma } from "@/server/infra/db/prisma";

export type EnqueueB2BMessageJobParams = {
  providerMessageId: string;
  phoneNumberId: string;
  conversationId: string;
  fromWaId: string;
  text: string | undefined;
};

export async function enqueueB2BMessageJob(params: EnqueueB2BMessageJobParams) {
  const { providerMessageId, phoneNumberId, conversationId, fromWaId, text } = params;

  // Idempotent enqueue: providerMessageId unique.
  const job = await prisma.agentJob.upsert({
    where: { providerMessageId },
    create: {
      domain: "B2B",
      kind: "B2B_MESSAGE",
      status: "PENDING",
      providerMessageId,
      phoneNumberId,
      conversationId,
      fromWaId,
      payload: { text },
    },
    update: {
      // if already exists, keep as-is; do not reset status
      phoneNumberId,
      conversationId,
      fromWaId,
      payload: { text },
    },
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_JOB_ENQUEUED",
      domain: "B2B",
      phoneNumberId,
      conversationId,
      payload: { agentJobId: job.id, providerMessageId },
    },
  });

  return job;
}

export async function claimNextB2BJob(params: { lockedBy: string }) {
  const { lockedBy } = params;

  // Best-effort claim loop (avoid races).
  for (let i = 0; i < 5; i++) {
    const next = await prisma.agentJob.findFirst({
      where: { domain: "B2B", status: "PENDING", kind: "B2B_MESSAGE" },
      orderBy: { createdAt: "asc" },
    });

    if (!next) return null;

    const updated = await prisma.agentJob.updateMany({
      where: { id: next.id, status: "PENDING" },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy,
        attempts: { increment: 1 },
      },
    });

    if (updated.count === 1) {
      await prisma.auditEvent.create({
        data: {
          eventType: "B2B_JOB_CLAIMED",
          domain: "B2B",
          phoneNumberId: next.phoneNumberId,
          conversationId: next.conversationId,
          payload: { agentJobId: next.id, lockedBy },
        },
      });

      return prisma.agentJob.findUnique({ where: { id: next.id } });
    }
  }

  return null;
}

export async function completeB2BJob(params: { id: string; lockedBy: string }) {
  const { id, lockedBy } = params;

  const job = await prisma.agentJob.update({
    where: { id },
    data: {
      status: "DONE",
      lockedBy,
      lockedAt: new Date(),
      lastError: null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_JOB_COMPLETED",
      domain: "B2B",
      phoneNumberId: job.phoneNumberId,
      conversationId: job.conversationId,
      payload: { agentJobId: job.id, lockedBy },
    },
  });

  return job;
}

export async function failB2BJob(params: { id: string; lockedBy: string; error: string }) {
  const { id, lockedBy, error } = params;

  const job = await prisma.agentJob.update({
    where: { id },
    data: {
      status: "FAILED",
      lockedBy,
      lockedAt: new Date(),
      lastError: error,
    },
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_JOB_FAILED",
      domain: "B2B",
      phoneNumberId: job.phoneNumberId,
      conversationId: job.conversationId,
      payload: { agentJobId: job.id, lockedBy, error },
    },
  });

  return job;
}


