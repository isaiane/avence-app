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

4) Reply (envio real via WhatsApp Cloud API):

```bash
curl -sS -X POST "$BASE_URL/api/mcp/b2b/reply-to-mei" \
  -H "content-type: application/json" \
  -H "x-mcp-token: $MCP_B2B_TOKEN" \
  -d "{\"businessId\":\"$BUSINESS_ID\",\"meiWaId\":\"$MEI_WA_ID\",\"text\":\"Onboarding concluído ✅\"}"
echo
```

Requisitos:
- `WHATSAPP_ACCESS_TOKEN` configurado no backend
- resolver `phoneNumberId` (passe `conversationId`/`phoneNumberId` no body, ou configure `AVENCE_PHONE_NUMBER_ID`)

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

Para habilitar o envio real no passo `reply-to-mei`:

```bash
UAT_SEND_REPLY=1 UAT_PHONE_NUMBER_ID="SEU_PHONE_NUMBER_ID" BASE_URL="http://localhost:3000" MCP_B2B_TOKEN="change-me" MEI_WA_ID="5511999999999" npm run uat:b2b
```

> Importante (zsh): se você definir variáveis em linhas separadas, use `export`, senão o `node` não recebe no `process.env`.

## Dispatcher B2B → Agent runtime (stub vs Agent Kit)
Por padrão, o backend roda com **agent stub** (sem OpenAI).

- **Stub (default)**: `B2B_AGENT_RUNTIME="stub"`
- **Agent Kit**: `B2B_AGENT_RUNTIME="agentkit"` + configurar `OPENAI_AGENT_KIT_MODULE` e `OPENAI_API_KEY`

Observação: a integração com Agent Kit está preparada via import dinâmico, mas o runner ainda é um placeholder até definirmos o pacote oficial e a API exata de tools do Agent Kit.

## Modelo agnóstico: Agent Jobs (outbox)
Para manter o backend **agnóstico** do orquestrador, o receiver **não chama o orquestrador diretamente**.
Em vez disso, ele cria um **`AgentJob`** no Postgres quando recebe uma mensagem B2B nova (idempotente por `providerMessageId`).

Um orquestrador externo (ex.: **flow/poller/worker**) deve:
1) **Puxar** o próximo job pendente
2) **Executar** orquestração (chamar MCP tools B2B)
3) **Confirmar** (complete) ou **marcar erro** (fail)

Endpoints (B2B):
- `GET /api/agent-jobs/b2b/next?lockedBy=...` (claim)
- `POST /api/agent-jobs/b2b/:id/complete?lockedBy=...`
- `POST /api/agent-jobs/b2b/:id/fail?lockedBy=...` body `{ "error": "..." }`

Auth:
- header `x-agent-jobs-token: $AGENT_JOBS_TOKEN`

Exemplo (claim):

```bash
curl -sS "$BASE_URL/api/agent-jobs/b2b/next?lockedBy=dev" \
  -H "x-agent-jobs-token: $AGENT_JOBS_TOKEN"
```

Exemplo (complete):

```bash
JOB_ID="..." # data.job.id do claim
curl -sS -X POST "$BASE_URL/api/agent-jobs/b2b/$JOB_ID/complete?lockedBy=dev" \
  -H "x-agent-jobs-token: $AGENT_JOBS_TOKEN"
```

## Worker externo (flow/poller) — passo a passo (agnóstico)
Qualquer ferramenta/serviço que consiga fazer **HTTP requests** com headers consegue orquestrar o B2B.

### Variáveis mínimas do worker
- `BASE_URL` (ex.: `http://localhost:3000`)
- `AGENT_JOBS_TOKEN` (para endpoints `/api/agent-jobs/*`)
- `MCP_B2B_TOKEN` (para endpoints `/api/mcp/b2b/*`)
- `LOCKED_BY` (identificador do worker, ex.: `worker-dev-1`)

### Loop de execução (contrato)
1) **Claim**: pegue 1 job pendente
2) Se `job=null`: não faça nada (volte a dormir/pollar)
3) Se `job!=null`: use `job.conversationId`, `job.fromWaId` (`meiWaId`) e `job.phoneNumberId` para chamar tools B2B
4) Ao terminar: **complete** ou **fail**

### Exemplo completo (shell / curl)
Claim:

```bash
JOB="$(curl -sS "$BASE_URL/api/agent-jobs/b2b/next?lockedBy=$LOCKED_BY" \
  -H "x-agent-jobs-token: $AGENT_JOBS_TOKEN")"
echo "$JOB"
```

Se tiver job, você terá `data.job.id`, `data.job.conversationId`, `data.job.fromWaId`, `data.job.phoneNumberId`.

Consultar status do MEI (Momento 1):

```bash
curl -sS -X POST "$BASE_URL/api/mcp/b2b/get-mei-status" \
  -H "content-type: application/json" \
  -H "x-mcp-token: $MCP_B2B_TOKEN" \
  -d "{\"meiWaId\":\"$MEI_WA_ID\",\"conversationId\":\"$CONVERSATION_ID\",\"phoneNumberId\":\"$PHONE_NUMBER_ID\"}"
echo
```

Responder o MEI:

```bash
curl -sS -X POST "$BASE_URL/api/mcp/b2b/reply-to-mei" \
  -H "content-type: application/json" \
  -H "x-mcp-token: $MCP_B2B_TOKEN" \
  -d "{\"meiWaId\":\"$MEI_WA_ID\",\"text\":\"Oi! Posso te fazer 3 perguntas rápidas?\",\"conversationId\":\"$CONVERSATION_ID\",\"phoneNumberId\":\"$PHONE_NUMBER_ID\"}"
echo
```

> `businessId` é opcional no `reply-to-mei` (útil no `SALES_RECEPTION` quando ainda não existe Business).

Complete:

```bash
curl -sS -X POST "$BASE_URL/api/agent-jobs/b2b/$JOB_ID/complete?lockedBy=$LOCKED_BY" \
  -H "x-agent-jobs-token: $AGENT_JOBS_TOKEN"
echo
```

Fail:

```bash
curl -sS -X POST "$BASE_URL/api/agent-jobs/b2b/$JOB_ID/fail?lockedBy=$LOCKED_BY" \
  -H "x-agent-jobs-token: $AGENT_JOBS_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"error\":\"...\"}"
echo
```

## ChatKit UI: conectar via MCP Server adapter
Se você quer usar a tela **“Connect to MCP Server”** do ChatKit, rode o **MCP adapter** (separado do Next):

1) Instale deps (uma vez):

```bash
npm install
```

2) Rode o backend Next normalmente (porta 3000).

3) Em outro terminal, rode o MCP adapter:

```bash
MCP_SERVER_PORT="3333" MCP_SERVER_TOKEN="change-me" MCP_ADAPTER_BACKEND_URL="http://localhost:3000" npm run mcp:dev
```

4) Exponha o adapter via ngrok:

```bash
ngrok http 3333
```

5) Na UI do ChatKit (Connect to MCP Server), preencha:
- **URL**: `https://SEU-NGROK.ngrok-free.app/mcp/sse`
- **Label**: `avence_mcp`
- **Authentication**: “Access token / API key”
- **Token**: o valor de `MCP_SERVER_TOKEN`

https://semihyperbolic-unconcordantly-eneida.ngrok-free.dev/mcp/sse

Obs: o adapter aceita o token via `Authorization: Bearer <token>` ou `x-api-key: <token>` (depende do cliente).

## Webhook WhatsApp
Endpoint:
- `GET /api/webhooks/whatsapp` → verify challenge
- `POST /api/webhooks/whatsapp` → eventos (assinatura + dedup + roteamento)

Variáveis:
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: comparado com `hub.verify_token` no GET
- `WHATSAPP_APP_SECRET`: valida `x-hub-signature-256` no POST
- `AVENCE_PHONE_NUMBER_ID`: (opcional) força domínio B2B quando o `phone_number_id` for o do Avence
- `WHATSAPP_ACCESS_TOKEN`: necessário para **enviar** mensagens via WhatsApp Cloud API (B2B `b2b.reply_to_mei`)
- `WHATSAPP_API_VERSION`: versão da Graph API (default: `v21.0`)
- `WHATSAPP_DEFAULT_FLOW_ID`: (opcional) Flow default para `b2b.send_flow`

## Envio real (B2B): `b2b.reply_to_mei`
O tool `b2b.reply_to_mei` agora **envia mensagem real** para o MEI via WhatsApp Cloud API.

Requisitos:
- Ter `WHATSAPP_ACCESS_TOKEN` válido
- Conseguir resolver `phoneNumberId` do envio:
  - passe `conversationId` (recomendado), ou `phoneNumberId` direto, ou configure `AVENCE_PHONE_NUMBER_ID`
- `businessId` é **opcional** (quando existir, será auditado; no SALES_RECEPTION pode ser omitido)

## Stateless checkpoints (B2B): `b2b.set_stage` + `b2b.get_context`
Para suportar o fluxo **stateless** do agente (conforme `knowledge/system-prompt.md`), existem duas tools:
- `b2b.set_stage`: persiste o estágio do onboarding (ex.: `SALES_RECEPTION`, `WAITING`) na `Conversation` e cria `AuditEvent` (`B2B_STAGE_SET`).
- `b2b.get_context`: retorna contexto resumido (stage/state, business/plan, services e availability) para a retomada.

Estágios (enum):
- `SALES_RECEPTION`
- `SALES_DIAGNOSIS`
- `ONBOARDING_ASSISTED`
- `ONBOARDING_COMPLETED`
- `PLAN_SELECTION`
- `WAITING`
- `HANDOFF_HUMAN`

## Flow (B2B): `b2b.send_flow`
O tool `b2b.send_flow` envia um **WhatsApp Flow** (mensagem `interactive/flow`) para coletar dados estruturados.
Requisitos:
- `WHATSAPP_ACCESS_TOKEN`
- `flowToken` + `flowCta` no tool call
- `flowId` no tool call **ou** `WHATSAPP_DEFAULT_FLOW_ID` no `.env`

## Banco (Prisma)
Modelos iniciais em `prisma/schema.prisma`:
- `PhoneNumberRoute`: mapping `phone_number_id` → domínio/negócio
- `InboundMessage`: dedup por `providerMessageId` (unique)
- `AuditEvent`: trilha mínima de auditoria
- `OutboundMessage`: idempotência + status de envio de mensagens


