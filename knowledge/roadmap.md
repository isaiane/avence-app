# Avence — Roadmap (NOW / NEXT / LATER)

> Versão base: **v0.4** (Agent Kit definido). Este roadmap deve refletir o estado real do produto e evoluir a cada entrega.

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

## NOW (Fase 1 — Colocar o Receiver em produção e validar com WhatsApp real)
Objetivo: validar o fluxo real ponta-a-ponta (verify + eventos + dedup) **rodando localmente** com um túnel (ex.: **ngrok**) — sem deploy em produção neste primeiro momento.

Checklist (mínimo):
- Subir Postgres local (ou dev) e aplicar migrações Prisma
- Rodar o Next.js localmente (`npm run dev`)
- Expor o endpoint via túnel (ex.: ngrok) apontando para a porta local
- Configurar o webhook no Meta/WhatsApp Cloud API usando a URL do túnel:
  - validar o **GET verify**
  - receber evento real no **POST**
- Semear `PhoneNumberRoute` para o `phone_number_id` do Business de teste (para validar B2C determinístico)

Teste manual:
- Configurar webhook real no Meta e validar o **GET verify**
- Enviar mensagem real e verificar que o **POST**:
  - valida assinatura
  - deduplica corretamente em reentrega
  - resolve domínio por `phone_number_id` (Avence → B2B; Business → B2C)

Critério de promoção (quando fizer sentido):
- Depois de validado via ngrok, promover para deploy em Vercel + Postgres gerenciado (produção/dev) com as mesmas env vars.

Critérios de aceite:
- Roteamento nunca depende do remetente
- Reprocessar a mesma mensagem não duplica efeitos
- Logs/auditoria incluem `domain`, `phone_number_id`, `conversation_id`

## NEXT (Fase 2 — Onboarding B2B mínimo via tools)
Objetivo: permitir onboarding end-to-end (B2B) com tools auditáveis.

Checklist (mínimo):
- `b2b.create_business`
- `b2b.upsert_services`
- `b2b.upsert_availability`
- Estado de conversa B2B: `ONBOARDING`

Teste manual:
- Simular conversa B2B de onboarding com fixtures e verificar criação/configuração.

Critérios de aceite:
- Onboarding só ocorre em B2B
- Saídas obrigatórias do onboarding persistidas (business/serviços/disponibilidade/plano Start)

## LATER
- Fase 3 — B2C Start (Copiloto): intents + templates + flows/webviews + handoff
- Fase 4 — B2C Pro/Pay (Autopiloto supervisionado): `AI_ACTIVE/HUMAN_ONLY`, agendamento, pagamento (Pay)
- Observabilidade completa + trilha de auditoria consolidada
- Segurança e compliance (segredos, PII, retenção de logs)


