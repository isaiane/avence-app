# Release / Snapshot — v0.2 (Stack e infra inicial definidas)

Data: 2026-01-19  
Versão: **v0.2**

## Título
Release v0.2 — Next.js + Vercel + Postgres/Prisma (planejamento do Receiver real)

## Resumo
Definição da stack e do caminho de implementação do MVP (Fase 1) com webhook real do WhatsApp desde o início.

## Principais mudanças
- Stack confirmada:
  - Next.js (App Router) + TypeScript
  - Backend via Route Handlers em `app/api/**/route.ts`
  - Deploy inicial: Vercel (serverless)
  - Postgres + Prisma desde o começo
- Receiver real desde o início:
  - `GET` verify (challenge)
  - `POST` com validação de assinatura usando corpo raw
  - deduplicação/idempotência persistida
  - roteamento por `phone_number_id`

## Estado do produto neste ponto
- KB atualizada para orientar a implementação.
- Código ainda não iniciado.


