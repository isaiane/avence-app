# Avence — Roadmap (NOW / NEXT / LATER)

> Versão base: **v0.7** (modelo agnóstico via AgentJob/outbox). Este roadmap deve refletir o estado real do produto e evoluir a cada entrega.

## DONE
- **(2026-01-19) v0.1 — Base de Conhecimento inicial**
  - KB criada a partir do contrato (`project.contract.md`)
  - Invariantes registrados (B2B2C, roteamento por `phone_number_id`, receiver único, MCPs separados)
- **(2026-01-19) v0.2 — Stack decidida + plano de implementação do Receiver**
  - Next.js (App Router) + TypeScript
  - Backend via Route Handlers (`app/api/**/route.ts`)
  - Deploy inicial: Vercel (serverless)
  - Postgres + Prisma desde o começo (mapping, dedup, auditoria)
  - Webhook real desde o início (validação de assinatura no corpo raw)
- **(2026-01-19) v0.3 — Receiver MVP implementado (código)**
  - Next.js app (App Router) no repositório
  - Prisma schema inicial (mapping `phone_number_id`, dedup, auditoria)
  - Endpoint único: `GET/POST /api/webhooks/whatsapp`
    - valida assinatura `x-hub-signature-256` no corpo raw
    - normaliza mensagens e persiste idempotentemente
    - resolve domínio por `phone_number_id` (Avence/DB/UNKNOWN)
- **(2026-01-19) v0.4 — Runtime de IA definido (OpenAI Agent Kit)**
  - OpenAI Agent Kit será o runtime que consome os MCPs (B2B e B2C)
  - MCPs permanecem separados por domínio, tools auditáveis e execução via backend
- **(2026-01-20) v0.5 — Tools B2B iniciais (onboarding)**
  - Modelos B2B mínimos no Prisma (plan, vínculo do MEI via `waId`, serviços, disponibilidade)
  - Endpoints “tool-like” B2B em `app/api/mcp/b2b/**` com auth por token (`MCP_B2B_TOKEN`) e auditoria
  - Validação do receiver via ngrok homologada (verify + ingest + inspect + seed)
- **(2026-01-20) v0.6 — Onboarding B2B homologado + UAT/testes**
  - UAT script: `npm run uat:b2b` (sem curl) executa onboarding B2B end-to-end
  - Smoke test: `npm run validate:smoke`
  - Testes automatizados (Vitest) cobrindo assinatura, normalização e rota de webhook
- **(2026-01-23) v0.7 — Orquestração agnóstica (AgentJob/outbox)**
  - Receiver/dispatcher cria `AgentJob` (idempotente) em vez de chamar Agent Kit direto
  - Consumidor externo (n8n/Agent Kit/worker) faz pull/ack e chama MCP tools

## NOW (Fase 3 — Orquestração externa consumindo Agent Jobs)
Objetivo: rodar a lógica de orquestração fora do backend (n8n/Agent Kit), consumindo `AgentJob` e chamando MCP tools.

Checklist (mínimo):
- Implementar consumidor externo (mínimo):
  - `GET /api/agent-jobs/b2b/next` (claim)
  - chamar tools MCP B2B necessárias
  - `POST /complete` ou `/fail`
- Definir estratégia de lock/retry (usar `lockedBy` e `attempts`)

Teste manual:
- Enviar mensagem B2B real e verificar:
  - `AgentJob` criado (audit: `B2B_JOB_ENQUEUED`)
  - consumidor claim/complete (audit: `B2B_JOB_CLAIMED`/`B2B_JOB_COMPLETED`)
  - tools chamadas e persistência confirmada

Critérios de aceite:
- Dispatcher não mistura domínios (sempre por `phone_number_id`)
- Tools executadas via backend (auditáveis)
- Estado de conversa persistido

## NEXT
- Integrar envio real de mensagens do Avence para o MEI (WhatsApp Cloud API) no `b2b.reply_to_mei`

## LATER
- Fase 3 — B2C Start (Copiloto): intents + templates + flows/webviews + handoff
- Fase 4 — B2C Pro/Pay (Autopiloto supervisionado): `AI_ACTIVE/HUMAN_ONLY`, agendamento, pagamento (Pay)
- Observabilidade completa + trilha de auditoria consolidada
- Segurança e compliance (segredos, PII, retenção de logs)


