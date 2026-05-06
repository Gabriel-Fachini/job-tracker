# Job Tracker — Product Requirements

## Visão

Ferramenta pessoal e local para inteligência sobre o processo de job hunting. O objetivo não é só rastrear candidaturas — é gerar dados suficientes para diagnosticar por que não está sendo contratado e tomar decisões melhores sobre onde e como aplicar.

**Princípio central:** mínimo atrito no registro. A ferramenta precisa ser tão rápida de usar que não dê vontade de pular.

---

## Entidades Centrais

### Empresa
Hub de informações sobre organizações de interesse, com vida própria independente de candidaturas.

### Candidatura
Relacionamento do usuário com uma vaga específica. Contém os dados da vaga (descrição completa preservada localmente, título, stack, etc.) e a timeline de etapas do processo seletivo. É a entidade central do produto.

### Perfil
Base de conhecimento sobre o usuário que alimenta geração de currículos e matching com vagas.

> **Decisão de design:** não existe uma entidade "Vaga" separada. Os dados da vaga (título, descrição, stack, salário, etc.) ficam embutidos diretamente na candidatura. Isso reduz fricção: registrar uma candidatura já é registrar a vaga.

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
- Uma empresa pode existir sem nenhuma candidatura associada
- Status atualiza automaticamente quando candidatura associada tem status alterado

---

### 3. Candidaturas

**Objetivo:** Registrar uma oportunidade e rastrear o relacionamento com ela do início ao fim, com timeline auditável. A candidatura carrega tanto os dados da vaga quanto o histórico do processo seletivo.

**Dados da vaga (embutidos na candidatura):**
- Empresa associada (referência obrigatória à entidade Empresa)
- Título da vaga, senioridade, stack exigida
- Modelo de trabalho (remoto / híbrido / presencial)
- Faixa salarial
- Fonte (plataforma onde apareceu) + URL original
- Descrição completa salva localmente
- Prazo de aplicação

**Dados do processo:**
- **Status** (para o board Kanban): `Aplicado | Em Processo | Oferta | Aprovado | Rejeitado | Desistiu`
- **Etapas** (string livre, dentro de "Em Processo"): ex. "Triagem RH", "Teste técnico", "Entrevista com CTO" — cada etapa tem data e notas
- Data de cada mudança de status (registrada automaticamente)
- Currículo efetivamente enviado nesta candidatura pode ser registrado manualmente ou marcado explicitamente como "sem currículo"
- Currículos gerados para esta candidatura (listados na página de detalhes)
- Contatos de RH (nome, cargo, email, LinkedIn)
- Canal de acompanhamento (email, plataforma, WhatsApp)
- Notas por etapa

**Fluxo principal — Registro por URL:**
1. Usuário cola a URL da vaga
2. Sistema acessa a página via scraper e extrai conteúdo
3. IA local processa o texto e preenche os campos automaticamente
4. Campos não encontrados ficam em branco para preenchimento manual
5. Usuário revisa e salva a candidatura

> ⚠️ A abordagem técnica do scraper (Playwright headless, fetch simples, agente de IA, etc.) ainda será definida e não está fechada nesta spec.

**Fluxo alternativo — Registro manual:**
1. Usuário cola a descrição da vaga diretamente
2. IA extrai campos automaticamente
3. Usuário revisa e salva

**Regras:**
- Toda candidatura deve estar associada a uma empresa já cadastrada
- Descrição sempre salva localmente no momento do registro
- Uma candidatura pode ser registrada diretamente como `Aplicado` ou em qualquer etapa posterior já conhecida do processo
- Toda mudança de status registra timestamp automaticamente
- Etapas são livres por design — cada empresa tem seu próprio processo
- Extração de campos deve ser feita pela stack local baseada em `ollama.cpp`

---

### 4. Geração de Currículo

**Objetivo:** Gerar automaticamente uma versão customizada do currículo em PDF a partir do perfil + descrição da vaga, acessível a partir da candidatura.

**Fluxo:**
1. Usuário acessa uma candidatura e aciona a geração de currículo
2. Usuário opcionalmente adiciona instruções livres (ex. "enfatize mais a experiência com Node.js")
3. Sistema cruza o perfil estruturado com a descrição da vaga via IA
4. IA seleciona experiências e bullets mais relevantes, ajusta linguagem para espelhar a descrição
5. Gera arquivo `.tex` e compila para PDF
6. Usuário recebe o PDF (fluxo síncrono com loading)
7. Referência salva automaticamente na candidatura — visível na seção de currículos gerados da candidatura

**Regras:**
- O `.tex` gerado sempre salvo junto com o PDF (auditabilidade)
- Nenhuma informação fabricada — só reorganização e ênfase do que existe no perfil
- Usuário pode regenerar quantas vezes quiser com instruções diferentes
- Histórico de currículos gerados aparece na página de detalhes da candidatura, não em página separada
- Geração de currículo deve usar a mesma fonte principal de IA local baseada em `ollama.cpp`
- Comparações com modelos GPT da OpenAI servem para avaliar qualidade de output, não para substituir o fluxo principal

---

### 5. Dashboard e Analytics

**Objetivo:** Visão consolidada do funil e insights para diagnóstico do processo seletivo.

**Métricas principais:**
- Total de candidaturas (período selecionável)
- Taxa de resposta (candidaturas que geraram qualquer contato)
- Funil de conversão por etapa (onde trava)
- Tempo médio em cada etapa
- Volume de candidaturas por semana

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

- Página de histórico global de currículos (currículos aparecem dentro da candidatura)
- Entidade "Vaga" separada da candidatura
- Scraping do Glassdoor
- Notificações e alertas automáticos
- Multi-usuário / autenticação
- Cloud sync
- Análise automática por IA dos motivos de rejeição
- Monitoramento agendado de job boards
- Chrome Extension (substituída pelo fluxo de registro por URL dentro do app)
