# Avence — Glossário

- **Avence**: produto B2B2C para MEIs, operando primariamente via WhatsApp.
- **MEI (B2B)**: cliente pagante do Avence; configura e opera o negócio.
- **Consumidor (B2C)**: usuário final da jornada do MEI; não paga e não cria conta.
- **B2B**: domínio Avence ⇄ MEI (onboarding/gestão/suporte/upgrades).
- **B2C**: domínio MEI ⇄ consumidor (agendamento/orçamento/pagamento).
- **`phone_number_id`**: identificador do número que recebe a mensagem no WhatsApp Cloud API; define **o domínio da conversa**.
- **Entrypoint B2B**: número WhatsApp do Avence (sempre Cloud API) → sempre B2B.
- **Entrypoint B2C**: número WhatsApp do negócio do MEI (Cloud API só Pro/Pay) → sempre B2C.
- **Webhook Receiver**: endpoint público único para receber eventos do WhatsApp; valida assinatura, normaliza, deduplica e roteia.
- **Roteamento determinístico**: regra fixa por `phone_number_id`, sem inferência por remetente.
- **MCP (Model Context Protocol)**: contrato formal entre agentes de IA e backend; define tools, schemas e permissões.
- **MCP B2B**: conjunto de tools do domínio B2B (gestão/orquestração).
- **MCP B2C**: conjunto de tools do domínio B2C (execução restrita/supervisionada).
- **Tool**: ação executável pelo backend sob comando do agente; toda tool call é auditável.
- **Idempotência/deduplicação**: garantia de que a mesma mensagem não gera efeitos duplicados.
- **Handoff humano**: transferência explícita para atendimento humano (obrigatória no B2C quando aplicável).
- **State machine**: estados permitidos da conversa por domínio (B2B e B2C separados).


