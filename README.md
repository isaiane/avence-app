# Avence (MVP) — Next.js + WhatsApp Webhook

Este repositório implementa o **receiver único** do webhook do WhatsApp (Cloud API) conforme `project.contract.md`:
- Validação de assinatura (HMAC no corpo raw)
- Normalização mínima
- Deduplicação/idempotência em Postgres
- Roteamento determinístico por `phone_number_id`

## Stack
- Next.js (App Router) + TypeScript
- Deploy: Vercel (serverless)
- Postgres + Prisma

## Setup local
1) Instale dependências:

```bash
npm install
```

2) Configure variáveis de ambiente:
- Copie `env.example` para `.env.local` (no seu ambiente local) e preencha os valores.

3) Rode migrações e gere o client:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4) Suba o dev server:

```bash
npm run dev
```

## Validar com WhatsApp real sem deploy (ngrok)
1) Exponha seu servidor local com ngrok (porta padrão do Next: 3000):

```bash
ngrok http 3000
```

2) Pegue a URL HTTPS gerada (ex.: `https://xxxx.ngrok-free.app`) e configure no Meta:
- **Callback URL**: `https://xxxx.ngrok-free.app/api/webhooks/whatsapp`
- **Verify token**: o mesmo valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

3) Valide o **GET verify** (Meta fará a chamada automaticamente ao salvar).

4) Envie uma mensagem real para o número de teste e verifique:
- `POST /api/webhooks/whatsapp` retorna 200 `{ success: true, ... }`
- `InboundMessage` recebe 1 linha por mensagem (dedup por `providerMessageId`)
- `AuditEvent` registra `WHATSAPP_WEBHOOK_RECEIVED`

## Webhook WhatsApp
Endpoint:
- `GET /api/webhooks/whatsapp` → verify challenge
- `POST /api/webhooks/whatsapp` → eventos (assinatura + dedup + roteamento)

Variáveis:
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: comparado com `hub.verify_token` no GET
- `WHATSAPP_APP_SECRET`: valida `x-hub-signature-256` no POST
- `AVENCE_PHONE_NUMBER_ID`: (opcional) força domínio B2B quando o `phone_number_id` for o do Avence

## Banco (Prisma)
Modelos iniciais em `prisma/schema.prisma`:
- `PhoneNumberRoute`: mapping `phone_number_id` → domínio/negócio
- `InboundMessage`: dedup por `providerMessageId` (unique)
- `AuditEvent`: trilha mínima de auditoria


