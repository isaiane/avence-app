# Snapshot Atual — Avence (v0.6)

Data: 2026-01-20  
Versão: **v0.6**  
Status: Onboarding B2B (manual) homologado + UAT/testes; pronto para dispatcher receiver → Agent Kit → tools

## O que existe hoje
- Base de Conhecimento inicial em `/knowledge`
- Invariantes do domínio registrados:
  - B2B2C
  - **domínio por `phone_number_id`**
  - webhook receiver único (validar assinatura, normalizar, deduplicar, rotear)
  - MCP B2B e MCP B2C separados (sem compartilhamento)
  - “IA decide, backend executa”
- Decisões de implementação (confirmadas):
  - **Next.js (App Router) + TypeScript**
  - Backend via **Route Handlers** em `app/api/**/route.ts`
  - Deploy inicial: **Vercel (serverless)**
  - **Postgres + Prisma** desde o começo
  - Webhook **real** desde o início (assinatura no corpo raw)
- Implementação inicial (código):
  - Prisma schema em `prisma/schema.prisma`
  - Receiver único em `src/app/api/webhooks/whatsapp/route.ts`
    - `GET` verify (challenge)
    - `POST` com validação de assinatura `x-hub-signature-256` (raw body)
    - normalização mínima + persistência idempotente (`InboundMessage`)
    - trilha mínima (`AuditEvent`)
    - roteamento determinístico por `phone_number_id` (Avence/DB/UNKNOWN)
- Decisão de IA:
  - Usaremos o **OpenAI Agent Kit** como runtime que consumirá os **MCPs B2B e B2C**
  - Invariante mantido: tools separadas por domínio; backend executa e audita
- Tools B2B (MVP inicial):
  - Endpoints “tool-like” protegidos por `MCP_B2B_TOKEN`:
    - `POST /api/mcp/b2b/create-business`
    - `POST /api/mcp/b2b/upsert-services`
    - `POST /api/mcp/b2b/upsert-availability`
    - `POST /api/mcp/b2b/reply-to-mei` (MVP: apenas audita)
- UATs e validação:
  - `npm run uat:b2b` executa onboarding B2B end-to-end sem curl
  - `npm run validate:smoke` valida verify + inspect
- Testes automatizados:
  - Vitest (`npm test`) cobrindo assinatura, normalização e rota de webhook (com mocks)

## Fluxos suportados (estado atual)
- **Receiver de webhook** (B2B/B2C/UNKNOWN) implementado e validável via ngrok.
- **Onboarding B2B (manual via tools)**: homologado via UAT (Business/Serviços/Disponibilidade + auditoria).

## Contratos obrigatórios (resumo)
- Receiver único público de webhook
- Roteamento determinístico por `phone_number_id`
- Separação rígida de state machines e MCPs por domínio
- Auditoria por tool call e logs mínimos por evento

## Limitações conhecidas
- Ainda não está validado em produção com WhatsApp real
- Necessário seed do mapping `PhoneNumberRoute` para `phone_number_id` de Business (B2C)
- Dispatcher automático receiver → Agent Kit → tools ainda não existe (chamadas são manuais)

## NOW (próximo passo mínimo testável)
Dispatcher B2B (automação):
- Ao receber inbound B2B (por `phone_number_id`), produzir contexto e chamar o Agent Kit
- Agent Kit chama tools B2B (com `businessId` resolvido via `MeiContact.waId`)
- Persistir estado em `Conversation.stateB2B`

## Configurações necessárias (para plugar no WhatsApp)
- Segredo de assinatura do WhatsApp (app secret / webhook secret)
- Verify token do webhook (para o GET challenge)
- `phone_number_id` do Avence (quando disponível; pode iniciar com placeholder)
- `DATABASE_URL` do Postgres (Vercel)
- `MCP_B2B_TOKEN` (para tools B2B)


