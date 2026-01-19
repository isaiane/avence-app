# Release / Snapshot — v0.4 (OpenAI Agent Kit definido)

Data: 2026-01-19  
Versão: **v0.4**

## Título
Release v0.4 — Runtime de IA: OpenAI Agent Kit (consumidor dos MCPs)

## Resumo
Definição do **OpenAI Agent Kit** como runtime de IA que consumirá os MCPs do Avence, mantendo os invariantes do contrato: separação B2B/B2C, execução via tools e auditabilidade.

## Principais mudanças
- Agent Runtime definido:
  - OpenAI Agent Kit consumirá MCP B2B e MCP B2C
- Invariantes reforçados:
  - MCPs seguem separados por domínio (sem compartilhamento de tools/schemas/permissões)
  - IA decide; backend executa (toda mutação via tools)
  - Tool calls auditáveis

## Estado do produto neste ponto
- Receiver MVP existe (v0.3) e está pronto para validação com WhatsApp real via ngrok.
- Próximo: validar webhook real + dedup + roteamento, então iniciar tools MCP B2B (onboarding).


