# Avence — Arquitetura (Atual + Proposta Inicial)

> Fonte de verdade de domínio: `project.contract.md`. Este documento traduz o contrato em arquitetura e decisões práticas.

## Invariantes (não negociáveis)
- **Domínio da conversa = `phone_number_id`** (nunca remetente).
- **Receiver único** público de webhook WhatsApp: validar assinatura, normalizar payload, deduplicar, rotear por `phone_number_id`.
- **Roteamento determinístico**:
  - `phone_number_id` do Avence → **B2B**
  - `phone_number_id` de Business (MEI) → **B2C**
- **Separação B2B/B2C**:
  - State machines não se misturam
  - MCPs não compartilham tools/schemas/permissões
- **IA decide, backend executa**: toda mutação passa por tools; tool call gera evento auditável.

## Componentes (visão lógica)
### 1) Webhook Receiver (WhatsApp Cloud API)
Responsabilidades:
- Verificar assinatura do webhook
- Normalizar payload para um formato interno
- Deduplicar mensagens (idempotência)
- Extrair `phone_number_id` e rotear determinísticamente

Saídas:
- Evento normalizado (ex.: `InboundMessageNormalized`)
- Enfileiramento/dispatch para o pipeline de domínio (B2B ou B2C)

### 2) Router por `phone_number_id`
Tabela/registro determinístico:
- `phone_number_id` → `{ domain, business_id? }`

Regras:
- Se o `phone_number_id` pertence ao Avence: `domain=B2B`
- Se pertence a um negócio (MEI): `domain=B2C` e contém `business_id`

### 3) Orquestração por MCP (Agent ↔ Backend)
## Agent Runtime (decisão)
- Usaremos o **OpenAI Agent Kit** como runtime de IA que **consome os MCPs** do Avence.
- O Agent Kit orquestra decisões e chama tools; o **backend executa** efeitos colaterais (contrato: “IA decide, backend executa”).

#### MCP B2B (Avence ⇄ MEI)
Propósito: onboarding, gestão, suporte, upgrades e ações auditáveis.

Propriedades:
- Todas as tools exigem `business_id` (quando aplicável, após onboarding)
- Nenhuma lógica B2C é exposta

Exemplos (contratuais):
- `b2b.create_business`
- `b2b.upsert_services`
- `b2b.upsert_availability`
- `b2b.reply_to_mei`

#### MCP B2C (MEI ⇄ Consumidor)
Propósito: execução restrita e atendimento supervisionado; capacidades variam por plano.

Propriedades:
- Não executa gestão/configuração de negócio
- Respostas sempre passam por tool
- Controle de estado de conversa: `AI_ACTIVE` / `HUMAN_ONLY`

Exemplos (contratuais):
- `b2c.detect_intent`
- `b2c.reply_template`
- `b2c.handoff`

## State Machines (contrato)
### Conversa B2B
- `ONBOARDING`
- `MANAGEMENT`
- `SUPPORT`
- `FALLBACK`

### Conversa B2C
- `AI_ACTIVE`
- `HUMAN_ONLY`

## Observabilidade & Auditoria
Invariantes:
- Toda tool call gera evento auditável
- Logs sempre incluem: `domain`, `business_id`, `conversation_id`, `tool_name`
- Nunca logar dados sensíveis

## Integração Agent Kit ↔ MCP (proposta inicial)
Objetivo: manter a separação rígida B2B/B2C e garantir auditabilidade.

- **MCP Servers separados por domínio**:
  - `mcp-b2b` expõe apenas tools B2B
  - `mcp-b2c` expõe apenas tools B2C
- **Política de execução**:
  - o Agent Kit **não** “faz” mutações fora de tools
  - o backend valida: domínio, plano/capacidade, e invariantes (ex.: nunca inferir por remetente)
- **Contexto mínimo por tool call** (sugestão):
  - `domain`, `phone_number_id`, `conversation_id`
  - `business_id` obrigatório em B2C e em B2B após onboarding

## Hipóteses (a confirmar)
> Decisões confirmadas (2026-01-19).

## Stack (decisão)
- **Framework**: Next.js (última versão) + TypeScript
- **Backend**: Next.js **Route Handlers** (App Router) em `app/api/**/route.ts`
- **Deploy**: **Vercel** (serverless) inicialmente
- **Banco**: **Postgres** desde o começo
- **ORM**: **Prisma**

## Design do Receiver (decisão)
Implementação alvo:
- `GET /api/webhooks/whatsapp` → verificação do webhook (challenge)
- `POST /api/webhooks/whatsapp` → validação de assinatura + normalização + deduplicação + roteamento determinístico por `phone_number_id`

Observação importante:
- A validação de assinatura exige acesso ao **corpo raw** da requisição; em Route Handlers isso deve ser feito a partir de `request.arrayBuffer()` (evitar transformações).

## Execução assíncrona (hipótese)
- Preferir responder **200 rápido** ao WhatsApp e processar o restante de forma assíncrona (fila) quando necessário.
- No MVP, o processamento pode ser síncrono desde que permaneça rápido e idempotente.


