# Release / Snapshot — v0.7 (Dispatcher B2B homologado com conversa canônica)

Data: 2026-01-23  
Versão: **v0.7**

## Título
Release v0.7 — Dispatcher B2B (stub) + rastreabilidade por `conversation_id`

## Resumo
Homologação do dispatcher B2B (stub) acionado pelo receiver, garantindo uma `Conversation` canônica no ingest e correlacionando auditoria por `conversation_id` e `phone_number_id`.

## Principais mudanças
- Receiver (B2B):
  - garante/recupera `Conversation` canônica no ingest
  - `WHATSAPP_WEBHOOK_RECEIVED` passa a registrar `conversation_id`
- Dispatcher:
  - executa apenas para mensagens novas (idempotência)
  - registra `B2B_DISPATCH_START/END`
- Tools B2B:
  - `B2B_CREATE_BUSINESS` e `B2B_REPLY_TO_MEI_REQUESTED` agora persistem `phone_number_id`

## Estado do produto neste ponto
- Dispatcher B2B comprovado em ambiente real (WhatsApp + ngrok) com trilha auditável coerente.
- Próximo: substituir o agent stub por OpenAI Agent Kit consumindo MCP B2B.


