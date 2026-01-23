import { prisma } from "@/server/infra/db/prisma";

export async function b2bCreateBusiness(params: {
  meiWaId: string;
  businessName?: string;
  meiDisplayName?: string;
  conversationId?: string;
  phoneNumberId?: string;
}) {
  const { meiWaId, businessName, meiDisplayName, conversationId, phoneNumberId } =
    params;

  const business = await prisma.business.create({
    data: { name: businessName },
  });

  await prisma.meiContact.upsert({
    where: { waId: meiWaId },
    create: { waId: meiWaId, displayName: meiDisplayName, businessId: business.id },
    update: { displayName: meiDisplayName, businessId: business.id },
  });

  const conversation = conversationId
    ? await prisma.conversation.upsert({
        where: { id: conversationId },
        create: {
          id: conversationId,
          domain: "B2B",
          stateB2B: "ONBOARDING",
          businessId: business.id,
          phoneNumberId,
          fromWaId: meiWaId,
        },
        update: {
          domain: "B2B",
          stateB2B: "ONBOARDING",
          businessId: business.id,
          phoneNumberId,
          fromWaId: meiWaId,
        },
      })
    : await prisma.conversation.create({
        data: {
          domain: "B2B",
          stateB2B: "ONBOARDING",
          businessId: business.id,
          phoneNumberId,
          fromWaId: meiWaId,
        },
      });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_CREATE_BUSINESS",
      domain: "B2B",
      businessId: business.id,
      phoneNumberId: conversation.phoneNumberId ?? undefined,
      conversationId: conversation.id,
      payload: { meiWaId },
    },
  });

  return { businessId: business.id, conversationId: conversation.id };
}

export async function b2bReplyToMeiRequested(params: {
  businessId: string;
  meiWaId: string;
  text: string;
  conversationId?: string;
  phoneNumberId?: string;
}) {
  const { businessId, meiWaId, text, conversationId, phoneNumberId } = params;

  const derivedPhoneNumberId =
    phoneNumberId ??
    (conversationId
      ? (
          await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { phoneNumberId: true },
          })
        )?.phoneNumberId ?? undefined
      : undefined);

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_REPLY_TO_MEI_REQUESTED",
      domain: "B2B",
      businessId,
      phoneNumberId: derivedPhoneNumberId,
      conversationId,
      payload: { meiWaId, text },
    },
  });

  return { sent: false as const };
}


