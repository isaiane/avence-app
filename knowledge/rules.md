# Avence — Rules (Execução do projeto)

Este arquivo consolida as regras práticas para desenvolvimento e atuação do copiloto (IA) no projeto Avence.

## Fontes de verdade (ordem de precedência)
1) `project.contract.md` (vinculante)  
2) `knowledge/snapshot-current.md` (estado atual)  
3) `knowledge/roadmap.md` (prioridades)  

## Regras de domínio (obrigatórias)
- **B2B2C**: separar domínios, estados e permissões.
- **Regra de Ouro**: o domínio da conversa é definido **exclusivamente** por **`phone_number_id`** (nunca remetente).
- **Entrypoints**:
  - número do Avence → sempre **B2B** (Cloud API)
  - número do Business (MEI) → sempre **B2C** (Cloud API só Pro/Pay)
- **Onboarding**: ocorre exclusivamente em **B2B** (via WhatsApp do Avence).
- **Planos controlam capacidades, nunca domínios**:
  - Start: não responde automaticamente consumidores via WhatsApp
  - Pro/Pay: pode responder consumidores com handoff humano obrigatório

## Regras técnicas (obrigatórias)
- **Receiver único** de webhook WhatsApp: validar assinatura, normalizar payload, deduplicar, rotear por `phone_number_id`.
- **Roteamento determinístico** (sem inferências).
- **IA decide, backend executa**:
  - IA não executa efeitos colaterais diretamente
  - toda mutação passa por **tools**
- **Nada importante acontece no texto**:
  - texto = interface
  - estado = backend
  - verdade = banco de dados
- **MCPs separados por domínio**:
  - MCP B2B e MCP B2C **não compartilham** tools, schemas ou permissões.

## Runtime de IA (decisão)
- Usaremos o **OpenAI Agent Kit** como runtime que consome os MCPs do Avence.
- O Agent Kit deve respeitar integralmente:
  - separação B2B/B2C
  - execução apenas via tools
  - auditabilidade por tool call

## Observabilidade & auditoria (obrigatórias)
- Toda tool call gera evento auditável.
- Logs mínimos devem incluir: `domain`, `business_id` (quando aplicável), `conversation_id`, `tool_name`.
- Nunca registrar dados sensíveis em logs.

## Base de Conhecimento (operação)
- Sempre que o projeto evoluir, atualizar:
  - `knowledge/roadmap.md`
  - `knowledge/snapshot-current.md`
  - e, se fizer sentido, criar `knowledge/snapshots/snapshot-vX.Y.md`
- Versionamento: SemVer (foco em MAJOR.MINOR; patch opcional).


