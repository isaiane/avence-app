# Avence — Visão Geral (Overview)

## O que é
O **Avence** é um produto **B2B2C** para **MEIs** que atendem consumidores finais, operando primariamente via **WhatsApp**.

- **Cliente (B2B)**: o **MEI** (pagante), que configura e gerencia o negócio dentro do Avence.
- **Usuário final (B2C)**: o **consumidor**, que interage com a jornada do MEI.
- **Princípio central**: o Avence não disputa a relação MEI–consumidor; atua como **infraestrutura invisível** que organiza e automatiza operações.

## Regra de Ouro (Domínio)
O **domínio da conversa** é definido **exclusivamente** pelo número que recebe a mensagem (**`phone_number_id`**), **nunca** pela identidade do remetente.

## Entrypoints de WhatsApp
- **B2B Entrypoint**: número do WhatsApp do **Avence** (sempre Cloud API) → sempre roteado para **lógica B2B**.
- **B2C Entrypoint**: número do WhatsApp do **negócio do MEI** (Cloud API apenas nos planos Pro/Pay) → sempre roteado para **lógica B2C**.

## Fluxos principais (alto nível)
### Fluxo B2B — Onboarding do MEI (via WhatsApp do Avence)
Objetivo: criar/ativar o negócio no Avence e deixar o plano Start ativo.

Saídas obrigatórias do onboarding:
- Business criado
- Serviços definidos
- Disponibilidade configurada
- Plano Start ativo

### Fluxo B2C — Jornada do consumidor (via WhatsApp do negócio)
Objetivo: atender intenções do consumidor (agendamento/orçamento/pagamento) com atuação variando por plano.

Regras de plano:
- **Start (Copiloto)**: não há resposta automática a consumidores via WhatsApp; B2C ocorre via links/Flows/Webviews + handoff humano.
- **Pro/Pay (Autopiloto)**: B2C integrado à Cloud API; pode responder consumidores com **handoff humano obrigatório**.

## Princípios de IA (produto + engenharia)
- **IA como orquestrador**: IA decide; **backend executa** efeitos colaterais.
- **Nada importante acontece no texto**: texto é interface; estado é backend; verdade é banco de dados.
- **MCP por domínio**: MCP B2B e MCP B2C são contratos separados e **não compartilham tools/schemas/permissões**.


