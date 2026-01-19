# Snapshot Atual — Avence (v0.4)

Data: 2026-01-19  
Versão: **v0.4**  
Status: Receiver MVP implementado + runtime de IA definido (OpenAI Agent Kit); pronto para validação com WhatsApp real via ngrok

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

## Fluxos suportados (estado atual)
- **Receiver de webhook** (B2B/B2C/UNKNOWN) implementado, mas ainda requer:
  - migração do banco
  - deploy em ambiente acessível ao WhatsApp (Vercel)
  - configuração do webhook no Meta

## Contratos obrigatórios (resumo)
- Receiver único público de webhook
- Roteamento determinístico por `phone_number_id`
- Separação rígida de state machines e MCPs por domínio
- Auditoria por tool call e logs mínimos por evento

## Limitações conhecidas
- Ainda não está validado em produção com WhatsApp real
- Necessário seed do mapping `PhoneNumberRoute` para `phone_number_id` de Business (B2C)
- Ainda não há pipeline de domínio (B2B/B2C) nem tools MCP

## NOW (próximo passo mínimo testável)
Validação real via ambiente local + túnel:
- Subir Postgres local (ou dev) + aplicar migrações Prisma
- Rodar o Next.js localmente
- Expor o endpoint via **ngrok** (ou similar)
- Configurar webhook no Meta e validar:
  - GET verify
  - POST events reais
  - dedup por `providerMessageId`
  - roteamento por `phone_number_id`

## Configurações necessárias (para plugar no WhatsApp)
- Segredo de assinatura do WhatsApp (app secret / webhook secret)
- Verify token do webhook (para o GET challenge)
- `phone_number_id` do Avence (quando disponível; pode iniciar com placeholder)
- `DATABASE_URL` do Postgres (Vercel)


