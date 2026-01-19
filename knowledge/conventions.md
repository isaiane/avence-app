# Avence — Convenções (Código, Domínio, Integração)

## Princípios (derivados do contrato)
- **Domínio nunca se mistura**: B2B e B2C são contextos isolados.
- **Roteamento determinístico por `phone_number_id`**: nunca por remetente.
- **IA não faz efeitos colaterais diretamente**: IA decide; backend executa via tools.
- **Nada importante acontece no texto**: estado persistido e auditável no backend.

## Contratos de borda (HTTP/Webhook/Tools)
- **Webhook receiver**:
  - validar assinatura
  - normalizar payload
  - deduplicar (idempotência)
  - rotear por `phone_number_id`
- **Tools (MCP)**:
  - toda ação mutável deve passar por tool
  - toda tool call deve gerar **evento auditável**
  - MCPs B2B e B2C não compartilham schemas/permissões/tools

## Agente de IA (decisão)
- Runtime: **OpenAI Agent Kit** consumindo os MCPs do Avence.
- O Agent Kit deve operar estritamente via tools:
  - sem efeitos colaterais “no texto”
  - sem bypass do backend
  - sem mistura de domínios (B2B/B2C)

## Padrões de modelagem (sugestão inicial)
- **Entidades mínimas**:
  - `Business`
  - `PhoneNumberRoute` (mapeia `phone_number_id` → domínio/negócio)
  - `Conversation` (com `domain` + estado)
  - `InboundMessage` (normalizada)
  - `DeduplicationKey` (ou tabela/índice para idempotência)
  - `AuditEvent` (tool calls + decisões relevantes)

## Observabilidade
- Logs estruturados com: `domain`, `business_id` (quando aplicável), `conversation_id`, `phone_number_id`, `tool_name`, `message_id`
- **Nunca** logar payloads sensíveis na íntegra; preferir hashes/IDs.

## Estrutura de pastas (proposta, adaptável à stack)
### Next.js (App Router) — recomendada para o MVP
- `src/app/api/webhooks/whatsapp/route.ts` → receiver único (GET verify + POST ingest)
- `src/server/routing/` → resolução de domínio por `phone_number_id`
- `src/server/domains/b2b/` e `src/server/domains/b2c/` → regras e state machines
- `src/server/mcp/b2b/` e `src/server/mcp/b2c/` → tools e schemas (separados)
- `src/server/infra/db/` → Prisma/Postgres
- `src/server/observability/` → logs/auditoria

## Webhook WhatsApp (Next Route Handler) — regras práticas
- Implementar **GET** (verificação) e **POST** (eventos) no mesmo endpoint.
- **Assinatura**:
  - Validar usando header `X-Hub-Signature-256` (HMAC-SHA256 do corpo raw)
  - Ler corpo como raw bytes via `request.arrayBuffer()` antes de parsear JSON
- **Idempotência**:
  - Deduplicar por ID de mensagem do provedor (ex.: `wamid`) com constraint única no banco
- **Resposta ao WhatsApp**:
  - Preferir responder 200 rapidamente e não falhar por payload desconhecido (registrar e auditar)

## Versionamento e snapshots
- Usar SemVer (foco em **MAJOR.MINOR**).
- Toda mudança relevante deve atualizar:
  - `knowledge/roadmap.md`
  - `knowledge/snapshot-current.md`
  - e, quando fizer sentido, criar `knowledge/snapshots/snapshot-vX.Y.md`


