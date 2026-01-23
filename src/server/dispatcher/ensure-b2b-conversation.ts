import { prisma } from "@/server/infra/db/prisma";

export async function ensureB2BConversation(params: {
  phoneNumberId: string;
  meiWaId: string;
}) {
  const { phoneNumberId, meiWaId } = params;

  const existing = await prisma.conversation.findFirst({
    where: { domain: "B2B", fromWaId: meiWaId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, businessId: true, stateB2B: true },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      domain: "B2B",
      stateB2B: "ONBOARDING",
      fromWaId: meiWaId,
      phoneNumberId,
    },
    select: { id: true, businessId: true, stateB2B: true },
  });
}


