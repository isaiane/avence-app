# Release / Snapshot — v0.6 (Onboarding B2B homologado + UAT/testes)

Data: 2026-01-20  
Versão: **v0.6**

## Título
Release v0.6 — Onboarding B2B homologado (tools) + UAT sem curl + testes automatizados

## Resumo
Homologação do onboarding B2B via tools (MCP B2B) com execução end-to-end por script, e introdução de base mínima de testes automatizados para evitar regressões no webhook.

## Principais mudanças
- UAT:
  - `npm run uat:b2b` executa `create-business → upsert-services → upsert-availability → reply-to-mei (audit)`
- Smoke test:
  - `npm run validate:smoke` (verify + inspect)
- Testes automatizados:
  - Vitest (`npm test`) cobrindo assinatura, normalização e rota do webhook

## Estado do produto neste ponto
- Receiver WhatsApp validado via ngrok.
- Tools B2B validadas/homologadas via UAT.
- Próximo passo: automatizar onboarding conectando **receiver → Agent Kit → tools** (dispatcher B2B).


