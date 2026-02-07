Project & Product Contract — Avence

Purpose: Este documento define o contrato de projeto e produto do Avence. Ele existe para dar contexto normativo ao copiloto de desenvolvimento (IA), garantindo decisões coerentes de arquitetura, domínio, integração com IA e evolução do produto.

Este contrato é vinculante: qualquer código, decisão técnica ou sugestão do copiloto deve respeitar as regras aqui descritas.

1. O que é o Avence

O Avence é um produto B2B2C para MEIs que atendem consumidores finais, operando primariamente via WhatsApp.

O MEI é o cliente do Avence (B2B)

O consumidor final é usuário da jornada do MEI (B2C)

O Avence não disputa a relação MEI–consumidor

O Avence atua como infraestrutura invisível que organiza, automatiza e viabiliza operações

2. Natureza B2B2C (Contrato de Domínio)

2.1 Domínio B2B — Avence ⇄ MEI

Cliente pagante

Responsável por configuração, decisões e risco

Interage com o número do WhatsApp do Avence

Usa o Avence para:

onboarding

gestão (agenda, serviços, financeiro)

suporte

upgrades de plano

2.2 Domínio B2C — MEI ⇄ Consumidor

Usuário final da jornada

Não paga o Avence

Não cria conta

Interage com o WhatsApp do negócio do MEI

Usa o fluxo para:

agendamento

orçamento

pagamento

Regra de Ouro (Obrigatória)

O domínio da conversa é definido exclusivamente pelo número que recebe a mensagem (phone_number_id).

Nunca pela identidade do remetente.

Um mesmo número pode atuar como:

MEI (B2B) em uma conversa

Consumidor (B2C) em outra

Sem conflito.

3. Entrypoints de WhatsApp (Contrato de Integração)

B2B Entrypoint

Número do WhatsApp do Avence

Sempre integrado à WhatsApp Cloud API

Sempre roteado para lógica B2B

B2C Entrypoint

Número do WhatsApp do negócio do MEI

Só integrado à Cloud API nos planos Pro/Pay

Sempre roteado para lógica B2C

4. Webhooks e Roteamento (Contrato Técnico)

4.1 Receiver Único

Existe um webhook receiver público

Ele é responsável apenas por:

validar assinatura

normalizar payload

deduplicar mensagens

rotear por phone_number_id

4.2 Roteamento Determinístico

Se phone_number_id pertence ao Avence → B2B

Se phone_number_id pertence a um Business → B2C

Nunca existe inferência por remetente.

5. Contrato de Onboarding

Onboarding ocorre exclusivamente no domínio B2B

Executado via WhatsApp do Avence

Consumidor não participa

Resultado do onboarding:

Business criado

serviços definidos

disponibilidade configurada

plano Start ativo

Upgrade para Pro/Pay:

ocorre após onboarding

é explícito

é auditável

permanece no domínio B2B

6. Planos e Capacidades

Start (Copiloto)

B2B ativo

B2C via links/Flows/Webviews

Avence não responde automaticamente consumidores

Pro / Pay (Autopiloto)

B2B ativo

B2C integrado à Cloud API

Avence pode responder consumidores

Handoff humano obrigatório

Planos controlam capacidades, nunca domínios.

7. Inteligência Artificial — Princípios

7.1 IA como Orquestrador

IA não executa efeitos colaterais diretamente

IA decide → backend executa

Toda mutação passa por tools

7.2 Nada Importante Acontece no Texto

Texto = interface

Estado = backend

Verdade = banco de dados

8. MCP (Model Context Protocol) do Avence

O Avence utiliza MCPs distintos por domínio, como contratos formais entre os AI Agents (Agent Kit) e o backend.

MCP B2B: orquestração e gestão (Avence ⇄ MEI)

MCP B2C: execução restrita e atendimento supervisionado (MEI ⇄ Consumidor)

Os MCPs não compartilham tools, schemas ou permissões.

8.1 MCP B2B — Orquestração de Negócio

Propósito

O MCP B2B é a fachada controlada do domínio B2B, permitindo que a IA:

conduza onboarding;

execute gestão operacional e financeira;

responda o MEI de forma controlada;

dispare Flows e Webviews.

Princípios

Todas as ações passam por tools B2B

Nenhuma lógica B2C é exposta

Tools **de mutação/efeito colateral** devem incluir `business_id` quando disponível (auditabilidade).
Tools de leitura/identificação (ex.: `b2b.get_mei_status`, `b2b.get_context`) podem operar sem `business_id`.

Todas as ações são auditáveis

Exemplos de Tools B2B

b2b.create_business

b2b.upsert_services

b2b.upsert_availability

b2b.create_expense

b2b.get_balance

b2b.send_flow

b2b.open_webview

b2b.reply_to_mei

8.2 MCP B2C — Execução Restrita de Jornada

Propósito

O MCP B2C permite que a IA atue no domínio B2C de forma segura e previsível, variando seu grau de atuação conforme o plano do negócio.

Ele é responsável por:

identificar intenções do consumidor;

responder com mensagens e templates predefinidos;

disparar Flows determinísticos;

executar ações supervisionadas (agenda, pagamento) nos planos superiores.

Princípios

MCP B2C não executa gestão

MCP B2C não altera configuração de negócio

MCP B2C não cria lógica livre de conversa

Toda resposta passa por tool

Capacidades por Plano

Start

detecção de intenção

respostas por template

cálculos simples (frete, preço base)

disparo de Flows

handoff humano

Pro / Pay

criação e confirmação de agendamento

respostas automáticas supervisionadas

iniciação de pagamento (Pay)

controle de estado da conversa (AI_ACTIVE / HUMAN_ONLY)

Exemplos de Tools B2C

b2c.detect_intent

b2c.reply_template

b2c.start_flow

b2c.calculate_quote

b2c.create_appointment

b2c.confirm_appointment

b2c.initiate_payment

b2c.handoff

9. Respostas do Agente (Contrato de Comunicação)

O agente pode responder o MEI no domínio B2B

Nunca responde consumidores via MCP B2B

Respostas sempre passam por tool (reply_to_mei)

Backend valida:

plano

tom

reciprocidade (texto/áudio)

limites do WhatsApp

10. State Machines

Conversa B2B

ONBOARDING

MANAGEMENT

SUPPORT

FALLBACK

Conversa B2C

AI_ACTIVE

HUMAN_ONLY

State machines não se misturam.

11. Observabilidade e Auditoria

Toda tool call gera evento auditável

Toda decisão relevante é rastreável

Logs incluem:

domain

business_id

conversation_id

tool_name

12. O que o Copiloto DEVE respeitar

O copiloto de desenvolvimento:

DEVE respeitar a separação B2B/B2C

DEVE usar MCP para qualquer ação do agente

NUNCA deve sugerir lógica B2C no MCP B2B

NUNCA deve inferir domínio por remetente

SEMPRE deve perguntar quando houver ambiguidade de domínio

13. Frase-âncora do Projeto

Avence vende para o MEI (B2B) e opera, de forma invisível, a jornada do consumidor (B2C).

IA decide. Backend executa. Domínio nunca se mistura.

Este contrato é a fonte de verdade para o copiloto.
Qualquer sugestão que o contradiga deve ser rejeitada ou ajustada.

