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

3) Garanta que o **database existe** no Postgres:

Se você estiver usando Postgres local:

```bash
createdb avence-app
```

> Alternativa: ajuste o nome do DB no seu `DATABASE_URL` para um database que já exista.

4) Rode migrações e gere o client:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5) Suba o dev server:

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

Sanity check local (simula o verify):

```bash
curl "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=$WHATSAPP_WEBHOOK_VERIFY_TOKEN&hub.challenge=123"
```

4) Envie uma mensagem real para o número de teste e verifique:
- `POST /api/webhooks/whatsapp` retorna 200 `{ success: true, ... }`
- `InboundMessage` recebe 1 linha por mensagem (dedup por `providerMessageId`)
- `AuditEvent` registra `WHATSAPP_WEBHOOK_RECEIVED`

Inspecionar rapidamente o que caiu no DB (dev):

```bash
curl "http://localhost:3000/api/admin/inspect?limit=20" \
  -H "x-admin-seed-token: $ADMIN_SEED_TOKEN"
```

Atalho (smoke test):

```bash
WHATSAPP_WEBHOOK_VERIFY_TOKEN="$WHATSAPP_WEBHOOK_VERIFY_TOKEN" \
ADMIN_SEED_TOKEN="$ADMIN_SEED_TOKEN" \
npm run validate:smoke
```

## Seed do roteamento por phone_number_id (dev)
Para validar B2C determinístico, você pode semear o mapping `phone_number_id → domain/business_id` via endpoint admin (protegido por token):

Endpoint:
- `POST /api/admin/seed-phone-route` com header `x-admin-seed-token: $ADMIN_SEED_TOKEN`

Exemplo (B2C):

```bash
curl -X POST "http://localhost:3000/api/admin/seed-phone-route" \
  -H "content-type: application/json" \
  -H "x-admin-seed-token: $ADMIN_SEED_TOKEN" \
  -d '{"phoneNumberId":"YOUR_BUSINESS_PHONE_NUMBER_ID","domain":"B2C","businessId":"biz_test_1","businessName":"Business Teste"}'
```

Alternativa (recomendada): seed via script (Prisma, sem server rodando)

Exemplo (B2C):

```bash
PHONE_NUMBER_ID="YOUR_BUSINESS_PHONE_NUMBER_ID" \
DOMAIN="B2C" \
BUSINESS_ID="biz_test_1" \
BUSINESS_NAME="Business Teste" \
npm run seed:phone-route
```

Exemplo (B2B):

```bash
PHONE_NUMBER_ID="YOUR_AVENCE_PHONE_NUMBER_ID" \
DOMAIN="B2B" \
npm run seed:phone-route
```

## Onboarding B2B em 2 minutos (curl)
Pré-requisitos:
- Backend rodando (ex.: `npm run dev`)
- `MCP_B2B_TOKEN` definido no ambiente do backend

Defina variáveis no seu terminal:

```bash
BASE_URL="http://localhost:3000"
MCP_B2B_TOKEN="change-me"
MEI_WA_ID="5511999999999"
```

1) Criar business (inicia onboarding) — retorna `businessId`:

```bash
BUSINESS_ID="$(curl -sS -X POST "$BASE_URL/api/mcp/b2b/create-business" \
  -H "content-type: application/json" \
  -H "x-mcp-token: $MCP_B2B_TOKEN" \
  -d "{\"meiWaId\":\"$MEI_WA_ID\",\"businessName\":\"Meu Negócio\",\"meiDisplayName\":\"MEI Teste\"}" \
  | node -p 'JSON.parse(fs.readFileSync(0,"utf8")).data.businessId')"
echo "BUSINESS_ID=$BUSINESS_ID"
```

2) Upsert de serviços:

```bash
curl -sS -X POST "$BASE_URL/api/mcp/b2b/upsert-services" \
  -H "content-type: application/json" \
  -H "x-mcp-token: $MCP_B2B_TOKEN" \
  -d "{\"businessId\":\"$BUSINESS_ID\",\"services\":[{\"name\":\"Corte\",\"priceCents\":5000,\"durationMin\":45},{\"name\":\"Barba\",\"priceCents\":3500,\"durationMin\":30}]}"
echo
```

3) Upsert de disponibilidade (substitui todas as regras existentes):

```bash
curl -sS -X POST "$BASE_URL/api/mcp/b2b/upsert-availability" \
  -H "content-type: application/json" \
  -H "x-mcp-token: $MCP_B2B_TOKEN" \
  -d "{\"businessId\":\"$BUSINESS_ID\",\"rules\":[{\"weekday\":1,\"startMin\":540,\"endMin\":1080},{\"weekday\":2,\"startMin\":540,\"endMin\":1080}]}"
echo
```

4) Reply (MVP: só audita intenção de resposta):

```bash
curl -sS -X POST "$BASE_URL/api/mcp/b2b/reply-to-mei" \
  -H "content-type: application/json" \
  -H "x-mcp-token: $MCP_B2B_TOKEN" \
  -d "{\"businessId\":\"$BUSINESS_ID\",\"meiWaId\":\"$MEI_WA_ID\",\"text\":\"Onboarding concluído ✅\"}"
echo
```

Dica de verificação:
- use `GET /api/admin/inspect?limit=50` (com `x-admin-seed-token`) para ver `AuditEvent` e os registros criados (`Business`, `Service`, `AvailabilityRule`).

## UAT B2B (sem curl)
Se preferir, rode o UAT do onboarding B2B via script (mais simples do que curl):

```bash
BASE_URL="http://localhost:3000" MCP_B2B_TOKEN="change-me" MEI_WA_ID="5511999999999" npm run uat:b2b
```

Opcional (personalizar nomes):

```bash
BASE_URL="http://localhost:3000" MCP_B2B_TOKEN="change-me" MEI_WA_ID="5511999999999" BUSINESS_NAME="Meu Negócio" MEI_DISPLAY_NAME="MEI Teste" npm run uat:b2b
```

> Importante (zsh): se você definir variáveis em linhas separadas, use `export`, senão o `node` não recebe no `process.env`.

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


