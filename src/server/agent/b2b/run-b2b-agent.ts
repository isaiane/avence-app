import { prisma } from "@/server/infra/db/prisma";
import { b2bCreateBusiness, b2bReplyToMeiRequested } from "@/server/domains/b2b/tools";

/**
 * Stub do Agent Kit (B2B).
 *
 * Por enquanto, o objetivo é apenas provar o encadeamento:
 * receiver → dispatcher → agent → tools (auditáveis).
 *
 * Próximo passo: substituir esta implementação por OpenAI Agent Kit.
 */
export async function runB2BAgent(params: {
  phoneNumberId: string;
  conversationId: string;
  meiWaId: string;
  text: string | undefined;
}) {
  const { phoneNumberId, conversationId, meiWaId, text } = params;

  // Resolve business se existir
  const contact = await prisma.meiContact.findUnique({
    where: { waId: meiWaId },
    select: { businessId: true },
  });

  let businessId = contact?.businessId ?? null;

  if (!businessId) {
    const created = await b2bCreateBusiness({
      meiWaId,
      conversationId,
      phoneNumberId,
    });
    businessId = created.businessId;

    await b2bReplyToMeiRequested({
      businessId,
      meiWaId,
      conversationId,
      phoneNumberId,
      text:
        "Bem-vindo ao Avence! Para começar, qual é o nome do seu negócio e quais serviços você oferece?",
    });

    return { action: "CREATED_BUSINESS", businessId };
  }

  // Se já existe, apenas registra uma resposta (audit-only) para provar o loop.
  await b2bReplyToMeiRequested({
    businessId,
    meiWaId,
    conversationId,
    phoneNumberId,
    text: `Recebi: "${text ?? ""}". (stub)`,
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_AGENT_STUB_RAN",
      domain: "B2B",
      businessId,
      phoneNumberId,
      conversationId,
      payload: { meiWaId, hasText: !!text },
    },
  });

  return { action: "REPLIED_STUB", businessId };
}


