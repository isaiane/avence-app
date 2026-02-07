/**
 * Integração com OpenAI Agent Kit (B2B).
 *
 * Este arquivo é carregado apenas quando B2B_AGENT_RUNTIME=agentkit.
 * Mantemos import dinâmico para não quebrar builds/dev caso o pacote ainda não esteja instalado.
 *
 * Nota: o nome do módulo pode variar conforme a distribuição do Agent Kit.
 * Configure OPENAI_AGENT_KIT_MODULE quando for ligar este runtime.
 */

export async function runB2BAgentWithAgentKit(_params: {
  phoneNumberId: string;
  conversationId: string;
  meiWaId: string;
  text: string | undefined;
}) {
  const moduleName = process.env.OPENAI_AGENT_KIT_MODULE;
  if (!moduleName) {
    throw new Error(
      "Missing OPENAI_AGENT_KIT_MODULE. Set it to the package name used by OpenAI Agent Kit (e.g. '@openai/agents' if applicable).",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mod: any = await import(moduleName);

  // TODO: implementar de fato com a API do Agent Kit escolhida:
  // - criar agent
  // - registrar tools B2B (create_business, upsert_services, upsert_availability, reply_to_mei)
  // - executar run com contexto {conversationId, phoneNumberId, meiWaId, text}
  //
  // Por enquanto, falhamos de forma explícita para evitar "fingir" que está integrado.
  throw new Error(
    `Agent Kit module '${moduleName}' loaded, but runner is not implemented yet. Next step: wire tools + prompt to Agent Kit.`,
  );
}


