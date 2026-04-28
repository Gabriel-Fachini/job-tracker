# Job Tracker — Product Requirements

## Visão

Ferramenta pessoal e local para inteligência sobre o processo de job hunting. O objetivo não é só rastrear candidaturas — é gerar dados suficientes para diagnosticar por que não está sendo contratado e tomar decisões melhores sobre onde e como aplicar.

**Princípio central:** mínimo atrito no registro. A ferramenta precisa ser tão rápida de usar que não dê vontade de pular.

---

## Entidades Centrais

### Empresa
Hub de informações sobre organizações de interesse, com vida própria independente de candidaturas.

### Vaga
Oportunidade específica vinculada a uma empresa, com descrição preservada localmente.

### Candidatura
Relacionamento do usuário com uma vaga específica, com timeline de etapas e status no board.

### Perfil
Base de conhecimento sobre o usuário que alimenta geração de currículos e matching com vagas.

---

## Módulos

### 1. Perfil Profissional

**Objetivo:** Base de conhecimento estruturada sobre o usuário que alimenta geração de currículos customizados e análise de fit com vagas.

**Fluxo principal:**
1. Usuário cola o currículo atual (texto ou PDF)
2. IA extrai e estrutura automaticamente
3. Usuário revisa e complementa campos

**Dados estruturados:**
- Identidade e contato
- Experiências profissionais (empresa, cargo, período, bullets de realizações por cargo)
- Stack e habilidades (com nível de proficiência e anos de experiência)
- Formação acadêmica
- Projetos pessoais (stack, descrição, link, impacto)
- Preferências (modelo de trabalho, tipo de empresa, missão/valores que importam)

**Currículo master:**
- Armazenado como PDF (arquivo original do usuário)
- Serve como referência visual base para as versões geradas

**Regras:**
- Todo campo editável após extração automática
- Extração automática deve usar o runtime local principal baseado em `ollama.cpp`
- Nesta fase, o sistema pode comparar a saída local com modelos GPT da OpenAI para benchmark, sem trocar a fonte principal de IA do produto

---

### 2. Empresas

**Objetivo:** Centralizar informações sobre empresas interessantes, independente de candidaturas abertas.

**Dados:**
- Nome, site, setor, tamanho estimado
- Link do job board
- Link do Glassdoor *(campo reservado para scraping futuro)*
- Status: `Monitorando | Em Processo | Descartada | Blacklist`
- Notas livres

**Regras:**
- Uma empresa pode existir sem nenhuma vaga associada
- Status atualiza automaticamente quando candidatura associada tem status alterado

---

### 3. Vagas

**Objetivo:** Registrar oportunidades com mínimo atrito, preservando a descrição completa mesmo que a vaga saia do ar.

**Dados:**
- Empresa associada
- Título, senioridade, stack exigida
- Modelo de trabalho (remoto / híbrido / presencial)
- Faixa salarial
- Fonte (plataforma onde apareceu) + URL original
- Descrição completa salva localmente
- Prazo de aplicação
- Status: `Interessante | Aplicando | Aplicada | Descartada`

**Fluxo principal — Extensão Chrome:**
1. Usuário navega no job board
2. Clica na extensão
3. Extensão captura URL + conteúdo da página
4. Abre popover com campos pré-preenchidos pela IA para revisão
5. Usuário confirma e salva

**Fluxo alternativo — Registro manual:**
1. Usuário cola a descrição da vaga no app
2. IA extrai campos automaticamente
3. Usuário revisa e salva

**Regras:**
- Descrição sempre salva localmente no momento do registro
- Uma vaga pode existir sem candidatura associada (status `Interessante`)
- Extração de campos de vaga deve ser feita pela stack local baseada em `ollama.cpp`

---

### 4. Candidaturas

**Objetivo:** Rastrear o relacionamento com uma vaga do início ao fim, com timeline auditável.

**Dados:**
- Vaga associada
- **Status** (para o board Kanban): `Aplicado | Em Processo | Oferta | Aprovado | Rejeitado | Desistiu`
- **Etapas** (string livre, dentro de "Em Processo"): ex. "Triagem RH", "Teste técnico", "Entrevista com CTO" — cada etapa tem data e notas
- Data de cada mudança de status (registrada automaticamente)
- Currículo usado (referência ao arquivo gerado)
- Contatos de RH (nome, cargo, email, LinkedIn)
- Canal de acompanhamento (email, plataforma, WhatsApp)
- Notas por etapa

**Regras:**
- Toda mudança de status registra timestamp automaticamente
- Uma candidatura nasce quando uma vaga é marcada como `Aplicando` ou `Aplicada`
- Etapas são livres por design — cada empresa tem seu próprio processo

---

### 5. Geração de Currículo

**Objetivo:** Gerar automaticamente uma versão customizada do currículo em PDF a partir do perfil + descrição da vaga.

**Fluxo:**
1. Usuário seleciona uma vaga (ou inicia pelo fluxo de candidatura)
2. Usuário opcionalmente adiciona instruções livres (ex. "enfatize mais a experiência com Node.js")
3. Sistema cruza o perfil estruturado com a descrição da vaga via IA
4. IA seleciona experiências e bullets mais relevantes, ajusta linguagem para espelhar a descrição
5. Gera arquivo `.tex` e compila para PDF
6. Usuário recebe o PDF (fluxo síncrono com loading)
7. Referência salva automaticamente na candidatura

**Regras:**
- O `.tex` gerado sempre salvo junto com o PDF (auditabilidade)
- Nenhuma informação fabricada — só reorganização e ênfase do que existe no perfil
- Usuário pode regenerar quantas vezes quiser com instruções diferentes
- Geração de currículo deve usar a mesma fonte principal de IA local baseada em `ollama.cpp`
- Comparações com modelos GPT da OpenAI servem para avaliar qualidade de output, não para substituir o fluxo principal do produto neste momento

---

### 6. Dashboard e Analytics

**Objetivo:** Visão consolidada do funil e insights para diagnóstico do processo seletivo.

**Métricas principais:**
- Total de vagas aplicadas (período selecionável)
- Taxa de resposta (aplicações que geraram qualquer contato)
- Funil de conversão por etapa (onde trava)
- Tempo médio em cada etapa
- Volume de aplicações por semana

**Análises de diagnóstico:**
- Taxa de rejeição por etapa → isola se o problema é currículo (rejeição pré-entrevista) ou performance em entrevista
- Correlação entre tipo/setor de empresa e taxa de avanço
- Correlação entre stack exigida e taxa de avanço
- Comparativo entre períodos (período atual vs anterior de mesmo tamanho)

**Regras:**
- Período padrão: últimos 30 dias
- Dados insuficientes (menos de 10 candidaturas) exibem aviso de baixa confiança estatística
- Análise do diagnóstico é responsabilidade do usuário — a ferramenta fornece os dados, não os interpreta automaticamente

---

## Fora do Escopo do MVP

- Scraping do Glassdoor
- Notificações e alertas automáticos
- Multi-usuário / autenticação
- Cloud sync
- Análise automática por IA dos motivos de rejeição
- Monitoramento agendado de job boards
