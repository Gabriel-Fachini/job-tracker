# AGENTS.md

## Objetivo

Este arquivo orienta **agentes de código** que trabalham neste repositório. O projeto é um **job tracker pessoal e local**, focado em reduzir atrito no registro de vagas, candidaturas e materiais de apoio, enquanto gera dados suficientes para análise do processo de job hunting.

O agente deve agir como implementador pragmático: ler o escopo real do projeto, comparar com o estado atual do código, executar a mudança pedida com o menor desvio possível e deixar claro quando houver divergência entre intenção e implementação existente.

## Ordem de precedência

Quando houver conflito entre documentos, siga esta ordem:

1. `.specs/spec.md`
2. `.specs/design.md`
3. `.specs/tasks.md`

Interpretação:

- `spec.md` define o objetivo do produto, regras de negócio, módulos e limites do MVP.
- `design.md` define a arquitetura, stack, estrutura de pastas e contratos técnicos esperados.
- `tasks.md` organiza a execução em fases, mas não substitui decisões já fechadas nos dois arquivos acima.

Se `tasks.md` sugerir algo que contradiga `spec.md` ou `design.md`, preserve `spec.md` e `design.md`.

## Regra de divergência

O código atual pode estar atrás do escopo descrito em `.specs`. Isso é esperado neste projeto.

Quando houver divergência entre o repositório e os documentos:

- o agente deve **avisar explicitamente** a divergência na resposta;
- o agente deve implementar com base na precedência acima, não apenas no estado atual do código;
- se a divergência revelar uma convenção durável, nova restrição ou mudança de direção que futuros agentes precisem conhecer, o agente deve **atualizar este `agents.md` no mesmo trabalho**;
- se a divergência for apenas um estado temporário de bootstrap ou WIP, basta sinalizar isso sem reescrever o escopo do projeto.

O agente não deve fingir que o estado atual do código já representa o sistema final.

## Stack fechada

As escolhas abaixo estão **fechadas** para este projeto e não devem ser rediscutidas por padrão:

- `Next.js 16` com `App Router`
- `TypeScript`
- `Tailwind CSS v4`
- `shadcn/ui`
- tema único `dark mode`, padrão do produto
- `Server Actions` para fluxos internos do app
- `Route Handlers` para integrações HTTP e casos que exigem endpoint explícito
- `Drizzle ORM` com `SQLite` local em arquivo
- runtime local com `ollama.cpp` como fonte principal de IA do produto
- `OpenAI` apenas para comparação de outputs com modelos GPT nesta fase
- `tectonic` para compilação LaTeX/PDF
- `Chrome Extension` Manifest V3 para captura de vagas
- gerenciador de pacotes padrão: `npm`

O agente pode propor ajustes de implementação, mas não deve trocar essas bases sem solicitação explícita.

## Estado atual do repositório

Hoje o repositório ainda está em estágio inicial. Ele já saiu do template puro do `create-next-app`, mas ainda está distante da arquitetura completa descrita em `.specs`.

Leituras importantes do estado atual:

- existe `Next.js 16` com `App Router`;
- o runtime local precisa atender ao requisito minimo do Next.js 16: `Node.js >= 20.9.0`;
- existe configuração de `shadcn/ui` em `components.json`;
- o projeto usa `package-lock.json`, então o padrão operacional é `npm`;
- os scripts atuais em `package.json` ainda são mínimos;
- o CSS atual ainda carrega tokens para light e dark mode, mas a direção correta do produto é **somente dark mode**;
- a arquitetura futura de banco, IA, uploads e extensão ainda precisa ser construída.

O agente deve tomar cuidado para não inferir que pastas ausentes significam mudança de escopo. Na maior parte dos casos, significa apenas que a fase ainda não foi implementada.

## Fluxo de trabalho esperado

Antes de codar:

1. Ler a solicitação do usuário.
2. Ler os arquivos de `.specs` relevantes ao pedido.
3. Conferir o código real que será afetado.
4. Declarar qualquer divergência relevante entre escopo e implementação atual.

Ao implementar:

1. Seguir o menor caminho coerente com o escopo do projeto.
2. Permitir atalhos técnicos quando fizer sentido, desde que não violem decisões fechadas do produto e da arquitetura.
3. Evitar over-engineering.
4. Não expandir escopo por conta própria.

Ao finalizar:

1. Validar o que for possível localmente.
2. Informar com clareza o que foi validado e o que não foi.
3. Atualizar este `agents.md` se surgiu uma nova regra operacional durável.

## Heurística para atalhos

Atalhos são permitidos quando reduzem trabalho sem comprometer o desenho principal. Exemplos aceitáveis:

- criar uma implementação simples que respeita a interface futura já definida;
- organizar código por feature antes de toda a árvore final existir;
- entregar um fluxo vertical mínimo de uma fase sem construir abstrações prematuras.

Atalhos não são aceitáveis quando:

- trocam uma tecnologia já fechada;
- introduzem uma arquitetura paralela à descrita em `.specs`;
- escondem dívida estrutural que vai colidir com fases seguintes;
- simplificam removendo regras explícitas do produto.

## Convenções de implementação

### 1. App Router primeiro

Prefira padrões idiomáticos de `Next.js App Router`.

- use `Server Components` por padrão;
- adicione `'use client'` apenas quando houver necessidade real de estado, efeito, browser API ou interação rica;
- use `Server Actions` para mutações internas do app;
- use `Route Handlers` para integrações externas, uploads, serving de arquivos ou contratos HTTP explícitos.

### 2. Organização de código

Siga a estrutura planejada em `.specs/design.md` sempre que possível:

- `src/app/` para rotas e handlers;
- `src/components/` para componentes reutilizáveis e componentes por feature;
- `src/lib/` para banco, IA, LaTeX e utilitários de infraestrutura;
- `src/server/actions/` para ações de servidor por módulo;
- `extension/` para a extensão Chrome;
- `uploads/` para artefatos locais gerados ou enviados.

Se uma pasta planejada ainda não existir e a tarefa pedir aquele domínio, crie-a já no formato esperado pelo design.

### 3. UI

Use `shadcn/ui` como base de componentes.

- preserve os aliases definidos em `components.json`;
- prefira compor em cima de componentes `ui/` em vez de reinventar primitives;
- trate `dark mode` como o **único** tema do produto;
- novas telas, componentes e tokens não devem depender de alternância light/dark;
- se encontrar suporte legado a tema claro, trate isso como estado transitório e não como contrato a preservar;
- mantenha acessibilidade, navegação por teclado e estados de loading/erro visíveis;
- evite UI genérica demais quando estiver construindo telas novas, mas preserve consistência com o que já existe no projeto.

### 4. Banco e dados

Para persistência local:

- use `Drizzle` com `SQLite`;
- trate o banco local como fonte de verdade do app;
- preserve nomes, entidades e relacionamentos definidos em `.specs/design.md`;
- não reduza o schema por conveniência se a tarefa depende da modelagem oficial.

### 5. IA e automação

- use o runtime local baseado em `ollama.cpp` como fonte principal para extração e geração no produto;
- trate a OpenAI, neste momento, como trilha comparativa de benchmark com modelos GPT, não como dependência principal do app;
- preserve a separação entre fluxo principal do produto e fluxo auxiliar de comparação;
- se a comparação com OpenAI estiver indisponível, o produto principal deve continuar coerente sem ela;
- se o runtime local estiver indisponível, implemente fallback somente quando isso já estiver previsto no escopo ou quando o fluxo puder degradar para revisão manual sem quebrar o contrato.

### 6. Arquivos locais

O projeto é local-first.

- preserve descrições completas de vagas localmente;
- preserve artefatos gerados relevantes, como `.tex` e `.pdf`, quando o fluxo exigir auditabilidade;
- trate caminhos de upload e geração como parte do contrato do sistema, não como detalhe descartável.

## Regras de escopo do produto

O agente deve respeitar estes princípios:

- o sistema é **single-user local**;
- o foco é **mínimo atrito** no registro;
- empresa, vaga, candidatura e perfil são as entidades centrais;
- a descrição da vaga deve ser preservada localmente;
- análise e dashboard servem para dar dados ao usuário, não para substituir seu julgamento;
- itens fora do escopo do MVP não devem ser puxados para dentro sem pedido explícito.

Fora do escopo por padrão:

- autenticação/multiusuário;
- cloud sync;
- scraping amplo não descrito no escopo;
- automações extras não previstas;
- novas superfícies de produto inventadas fora das fases.

## Validação

Use `npm` como padrão em comandos de instalação, execução e validação.

Comandos base atuais:

- `npm run dev`
- `npm run lint`
- `npm run build`

Regras:

- valide no menor nível suficiente para a mudança;
- se a mudança tocar contrato de build, rotas, imports ou tipos, prefira ao menos `npm run lint` e `npm run build` quando viável;
- se não for possível validar algo, diga exatamente o motivo;
- não invente suíte de testes inexistente.

## README

Por padrão, **não** atualize `README.md` durante tarefas normais, mesmo que ele esteja desatualizado, a menos que o usuário peça isso explicitamente.

## O que futuros agentes devem evitar

- assumir que ausência de código significa mudança de requisito;
- tratar o template atual como arquitetura final;
- trocar `npm` por outro gerenciador;
- substituir `Server Actions` por uma camada REST interna sem necessidade;
- pular leitura de `.specs` antes de mexer em áreas relevantes;
- fazer refactors genéricos que não movem o projeto em direção ao escopo definido.

## Regra prática final

Se houver dúvida sobre o que fazer:

1. volte para `.specs/spec.md`;
2. confirme a forma técnica em `.specs/design.md`;
3. use `.specs/tasks.md` para escolher o recorte mais pragmático;
4. compare isso com o estado real do código;
5. implemente sem ampliar o escopo;
6. sinalize divergências com honestidade.
