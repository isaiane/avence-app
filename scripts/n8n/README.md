# n8n — Worker B2B (AgentJobs -> MCP)

Este diretório contém um workflow **importável** no n8n para rodar a orquestração B2B sem ChatKit.

## Pré-requisitos

- Backend Next.js rodando (`npm run dev`)
- Banco migrado (`npm run prisma:migrate`)
- Variáveis no n8n (Environment Variables):
  - `AVENCE_BACKEND_URL` (ex.: `http://localhost:3000`)
  - `AGENT_JOBS_TOKEN` (mesmo do backend)
  - `MCP_B2B_TOKEN` (mesmo do backend)
  - `N8N_WORKER_ID` (ex.: `n8n-dev-1`)

## Importar workflow

Importe o arquivo:

- `scripts/n8n/workflows/b2b-worker-v0.json`

## O que o workflow faz (v0)

- A cada execução:
  - chama `GET /api/agent-jobs/b2b/next?lockedBy=...`
  - se vier job:
    - chama `POST /api/mcp/b2b/get-mei-status`
    - envia uma resposta padrão via `POST /api/mcp/b2b/reply-to-mei` (**sem businessId**, permitido)
    - marca job como `complete`

> Observação: este v0 é propositalmente simples (sem LLM) para validar o pipeline ponta-a-ponta.


