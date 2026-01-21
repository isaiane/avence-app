# Release / Snapshot — v0.5 (Tools B2B iniciais)

Data: 2026-01-20  
Versão: **v0.5**

## Título
Release v0.5 — Tools B2B iniciais para onboarding (MCP B2B)

## Resumo
Adição de modelos mínimos do domínio B2B no Prisma e endpoints “tool-like” (MCP B2B) para suportar o onboarding via Agent Kit, com autenticação por token e auditoria.

## Principais mudanças
- Prisma (B2B):
  - `Plan` em `Business`
  - `MeiContact` (vínculo `waId` → `businessId`)
  - `Service` e `AvailabilityRule`
  - `Conversation` (estado B2B)
- MCP B2B (tool-like endpoints, protegidos por `MCP_B2B_TOKEN`):
  - `POST /api/mcp/b2b/create-business`
  - `POST /api/mcp/b2b/upsert-services`
  - `POST /api/mcp/b2b/upsert-availability`
  - `POST /api/mcp/b2b/reply-to-mei` (MVP: audit only)

## Estado do produto neste ponto
- Receiver do WhatsApp já validado via ngrok.
- Onboarding B2B pode ser executado manualmente via tools e verificado via auditoria/DB.
- Próximo: dispatcher receiver → Agent Kit → tools (automação do onboarding).


