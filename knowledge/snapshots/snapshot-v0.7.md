# Release / Snapshot — v0.7 (Orquestração agnóstica via AgentJob/outbox)

Data: 2026-01-23  
Versão: **v0.7**

## Título
Release v0.7 — AgentJob/outbox (backend agnóstico ao orquestrador)

## Resumo
Mudança arquitetural para manter o backend agnóstico: ao receber mensagens B2B novas, o backend cria um `AgentJob` no Postgres (idempotente). Um consumidor externo (n8n / OpenAI Agent Kit / worker) faz claim/complete/fail e chama as MCP tools do backend.

## Principais mudanças
- Prisma:
  - Novo modelo `AgentJob` + enum `AgentJobStatus`
- API (consumo de jobs B2B):
  - `GET /api/agent-jobs/b2b/next?lockedBy=...`
  - `POST /api/agent-jobs/b2b/:id/complete?lockedBy=...`
  - `POST /api/agent-jobs/b2b/:id/fail?lockedBy=...` body `{ error }`
  - Auth via `x-agent-jobs-token: $AGENT_JOBS_TOKEN`
- Auditoria:
  - `B2B_JOB_ENQUEUED`, `B2B_JOB_CLAIMED`, `B2B_JOB_COMPLETED`, `B2B_JOB_FAILED`

## Estado do produto neste ponto
- Backend pronto para ser consumido por qualquer orquestrador.
- Próximo passo: implementar o consumidor (n8n ou Agent Kit) que transforma `AgentJob` em tool calls.


