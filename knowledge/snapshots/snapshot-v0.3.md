# Release / Snapshot — v0.3 (Receiver MVP implementado)

Data: 2026-01-19  
Versão: **v0.3**

## Título
Release v0.3 — Webhook Receiver real (assinatura + dedup + roteamento)

## Resumo
Implementação do MVP do **receiver único** do WhatsApp dentro do Next.js (Route Handlers), com validação de assinatura no corpo raw, normalização mínima, deduplicação em Postgres e trilha mínima de auditoria.

## Principais mudanças
- Next.js (App Router) + TypeScript no repositório
- Prisma + Postgres (schema inicial):
  - `PhoneNumberRoute` (mapping `phone_number_id`)
  - `InboundMessage` (dedup por `providerMessageId`)
  - `AuditEvent` (auditoria mínima)
- Endpoint único:
  - `GET /api/webhooks/whatsapp` (verify challenge)
  - `POST /api/webhooks/whatsapp`:
    - valida `x-hub-signature-256` (HMAC-SHA256 no raw body)
    - persiste mensagens idempotentemente
    - resolve domínio por `phone_number_id` (Avence/DB/UNKNOWN)

## Estado do produto neste ponto
- Código pronto para deploy na Vercel + Postgres e validação com WhatsApp real.


