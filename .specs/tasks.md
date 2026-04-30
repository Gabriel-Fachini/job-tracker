# Job Tracker — Tasks

## Fase 1 — Setup

- [x] 1.1 Inicializar projeto Next.js 16 com TypeScript e App Router
- [x] 1.2 Configurar Tailwind CSS
- [x] 1.3 Instalar e configurar shadcn/ui
- [x] 1.4 Instalar Drizzle ORM e better-sqlite3
- [x] 1.5 Criar `drizzle.config.ts` apontando para `./job-tracker.db`
- [x] 1.6 Criar `src/lib/db/schema.ts` com todas as tabelas definidas no System Design
- [x] 1.7 Rodar migration inicial e validar criação das tabelas
- [x] 1.8 Criar instância singleton do client SQLite em `src/lib/db/index.ts`
- [x] 1.9 Criar `.env.local` com todas as variáveis de ambiente
- [x] 1.10 Criar estrutura de pastas `uploads/resumes/master/` e `uploads/resumes/generated/`
- [x] 1.11 Configurar `next.config.ts` para permitir serving de arquivos da pasta `uploads/`
- [x] 1.12 Criar layout raiz com sidebar de navegação entre módulos
- [x] 1.13 Criar página raiz redirecionando para `/dashboard`

> ⚠️ **Divergência de schema:** o schema atual em `src/lib/db/schema.ts` pode ainda ter a tabela `jobs` separada da tabela `applications`. Isso deve ser corrigido: os campos de vaga foram movidos para dentro de `applications`. A migration correspondente precisa ser gerada e aplicada.

---

## Fase 2 — Módulo Perfil

### 2.1 Integração local com `ollama.cpp`

- [x] 2.1.1 Criar client do runtime local em `src/lib/ai/ollama.ts`
- [x] 2.1.2 Definir configuração mínima do modelo local (`OLLAMA_CPP_BASE_URL`, `OLLAMA_CPP_MODEL`)
- [x] 2.1.3 Criar função `extractProfileFromText(rawText: string)` que chama o modelo local e retorna JSON estruturado do perfil
- [x] 2.1.4 Validar e tipar o JSON retornado pelo modelo local contra o schema do banco

### 2.2 Comparação com GPT da OpenAI

- [x] 2.2.1 Instalar OpenAI SDK (`openai`)
- [x] 2.2.2 Criar client OpenAI em `src/lib/ai/openai.ts`
- [x] 2.2.3 Criar utilitário `compareProfileExtraction(rawText: string)` que rode o mesmo input no fluxo local e em um modelo GPT da OpenAI
- [x] 2.2.4 Definir formato local de comparação para inspeção manual dos resultados
- [x] 2.2.5 Garantir que a comparação seja opcional e não bloqueie o fluxo principal do produto

### 2.3 Upload e extração

- [x] 2.3.1 Criar página `/profile`
- [x] 2.3.2 Criar componente de upload de PDF (currículo master)
- [x] 2.3.3 Criar Route Handler `POST /api/profile/upload` para receber o PDF, salvar em `uploads/resumes/master/` e extrair texto
- [x] 2.3.4 Criar Server Action `extractProfile(rawText)` que chama o modelo local e persiste o perfil estruturado no banco
- [x] 2.3.5 Exibir loading state durante extração

### 2.4 Formulário de revisão

- [x] 2.4.1 Criar seção de identidade e contato (campos editáveis)
- [x] 2.4.2 Criar seção de experiências profissionais com lista de bullets editáveis por cargo
- [x] 2.4.3 Criar seção de habilidades com nível e categoria
- [x] 2.4.4 Criar seção de projetos pessoais
- [x] 2.4.5 Criar seção de formação acadêmica
- [x] 2.4.6 Criar seção de preferências (modelo de trabalho, tipo de empresa, valores)
- [x] 2.4.7 Criar Server Action `updateProfile(data)` para persistir edições
- [x] 2.4.8 Permitir adicionar/remover experiências, bullets, habilidades e projetos manualmente

---

## Fase 3 — Módulo Empresas

- [x] 3.1 Criar página `/companies` com listagem em tabela
- [x] 3.2 Criar página `/companies/new` com formulário de cadastro
- [x] 3.3 Criar página `/companies/[id]` com detalhes e candidaturas associadas
- [x] 3.4 Criar Server Actions: `createCompany`, `updateCompany`, `deleteCompany`
- [x] 3.5 Implementar atualização automática de status da empresa quando candidatura associada muda de status

---

## Fase 4 — Módulo Candidaturas

> **Contexto:** candidaturas são a entidade central do produto. Cada candidatura carrega os dados da vaga (título, descrição, stack, etc.) e o histórico do processo seletivo. Não existe módulo/página separada de vagas.

### 4.1 Registro de candidatura — Entrada por URL (Registry de plataformas)

A extração vive em código, sem entidade de banco para plataformas. A arquitetura é um registry TypeScript que mapeia domínio → extrator. Adicionar nova plataforma = novo arquivo + uma linha no registry.

**Plataformas com suporte no MVP:**

- **Gupy** → API pública (`api.gupy.io/api/v1/jobs/{id}`) — sem IA, dados estruturados direto
- **Greenhouse** → API pública (`boards-api.greenhouse.io/...`) — sem IA, dados estruturados direto
- **Lever** → API pública (`api.lever.co/v0/postings/...`) — sem IA, dados estruturados direto
- **Qualquer outra** → `fetch` + `cheerio` + modelo local (ollama) extrai campos do texto

- [ ] 4.1.1 Instalar `cheerio` como dependência
- [ ] 4.1.2 Criar `src/lib/scraper/types.ts` com o tipo `ExtractedJob` (contrato comum de saída de todos os extratores)
- [ ] 4.1.3 Criar `src/lib/scraper/platforms/gupy.ts` — extrai jobId da URL, chama API pública da Gupy, mapeia resposta para `ExtractedJob`
- [ ] 4.1.4 Criar `src/lib/scraper/platforms/greenhouse.ts` — extrai slug da URL, chama API pública do Greenhouse, mapeia para `ExtractedJob`
- [ ] 4.1.5 Criar `src/lib/scraper/platforms/lever.ts` — extrai slug da URL, chama API pública do Lever, mapeia para `ExtractedJob`
- [ ] 4.1.6 Criar `src/lib/scraper/platforms/generic.ts` — `fetch` da URL, `cheerio` extrai texto limpo, modelo local (ollama) extrai campos, retorna `ExtractedJob` com `null` onde não encontrou
- [ ] 4.1.7 Criar `src/lib/scraper/registry.ts` — mapeia domínio para extrator; domínios não mapeados delegam para `generic`
- [ ] 4.1.8 Criar `src/lib/scraper/index.ts` — entry point `scrapeAndExtract(url)` que chama `getExtractor(url)` e executa
- [ ] 4.1.9 Criar Server Action `scrapeAndExtractJob(url)` em `applications.ts` que chama `scrapeAndExtract`, localiza/cria empresa se `companyName` presente, e retorna `ExtractedJob` para a UI
- [ ] 4.1.10 Implementar fallback de erro: se o extrator lançar exceção, retornar `ExtractedJob` com todos os campos `null` e `sourceUrl` preenchida — sem quebrar o fluxo

### 4.2 Registro de candidatura — Formulário

- [x] 4.2.1 Criar página `/applications/new` com campo de URL (fluxo principal) e área para colar descrição (fluxo alternativo)****
- [ ] 4.2.2 Após extração, exibir formulário com campos pré-preenchidos para revisão, incluindo seleção obrigatória de empresa já cadastrada
- [ ] 4.2.3 Criar Server Action `createApplication(data)` que persiste candidatura com todos os campos de vaga embutidos
- [ ] 4.2.4 Salvar descrição completa no campo `description` da candidatura, independentemente dos outros campos

### 4.3 Listagem — Board Kanban

- [ ] 4.3.1 Criar página `/applications` com board Kanban
- [ ] 4.3.2 Implementar colunas: `Interessante | Aplicado | Em Processo | Oferta | Aprovado | Rejeitado | Desistiu`
- [ ] 4.3.3 Implementar drag-and-drop entre colunas (estado client-side)
- [ ] 4.3.4 Ao soltar card em nova coluna, chamar Server Action `updateApplicationStatus(id, newStatus)`
- [ ] 4.3.5 Server Action deve registrar entrada em `application_status_history` automaticamente

### 4.4 Detalhes da candidatura

- [ ] 4.4.1 Criar página `/applications/[id]` com detalhes completos
- [ ] 4.4.2 Exibir dados da vaga: título, empresa, descrição completa, stack, salário, modelo de trabalho, URL original
- [ ] 4.4.3 Criar componente de timeline de etapas (label + data + notas)
- [ ] 4.4.4 Implementar adição de nova etapa via formulário inline
- [ ] 4.4.5 Criar Server Actions: `createApplicationStage`, `updateApplicationStage`, `deleteApplicationStage`
- [ ] 4.4.6 Criar seção de contatos de RH (nome, cargo, email, LinkedIn)
- [ ] 4.4.7 Criar campo de canal de acompanhamento
- [ ] 4.4.8 Criar Server Action `updateApplication(id, data)` para edição dos campos da candidatura
- [ ] 4.4.9 Exibir seção de currículos gerados para esta candidatura (lista com link para download do PDF)

---

## Fase 5 — Geração de Currículo

### 5.1 Compilador LaTeX

- [ ] 5.1.1 Verificar instalação do `tectonic` na máquina e documentar pré-requisito no README
- [ ] 5.1.2 Criar wrapper `src/lib/latex/compiler.ts` invocando `tectonic` via `child_process.execFile`
- [ ] 5.1.3 Implementar timeout de 30s e captura de stderr para erros de compilação
- [ ] 5.1.4 Validar que o PDF foi gerado no outdir após execução

### 5.2 Geração via IA

- [ ] 5.2.1 Criar Server Action `generateResume(applicationId, additionalInstructions?)` com o fluxo completo descrito no System Design
- [ ] 5.2.2 Criar prompt de sistema para o modelo local que instrui geração de `.tex` completo a partir do perfil e descrição da candidatura
- [ ] 5.2.3 Definir convenção de nomes dos arquivos gerados: `{slug-empresa}-{slug-vaga}-{timestamp}`
- [ ] 5.2.4 Salvar `.tex` e `.pdf` em `uploads/resumes/generated/{slug}/`
- [ ] 5.2.5 Persistir registro na tabela `resumes` vinculado ao `applicationId`

### 5.3 UI de geração (dentro da candidatura)

- [ ] 5.3.1 Criar componente de geração acessível a partir da página `/applications/[id]`
- [ ] 5.3.2 Adicionar campo de instruções adicionais (textarea opcional)
- [ ] 5.3.3 Implementar loading state síncrono durante geração e compilação
- [ ] 5.3.4 Criar Route Handler `GET /api/resumes/[id]/pdf` para serving do arquivo PDF gerado
- [ ] 5.3.5 Exibir link para download do PDF na seção de currículos da candidatura após geração
- [ ] 5.3.6 Listar todos os currículos gerados para a candidatura com data e link de download

---

## Fase 6 — Dashboard e Analytics

### 6.1 Queries de dados

- [ ] 6.1.1 Criar query `getFunnelStats(startDate, endDate)` — total por status e taxas de conversão
- [ ] 6.1.2 Criar query `getResponseRate(startDate, endDate)` — candidaturas que saíram de `Aplicado`
- [ ] 6.1.3 Criar query `getAverageTimePerStage(startDate, endDate)` — tempo médio entre mudanças de status
- [ ] 6.1.4 Criar query `getApplicationsPerWeek(startDate, endDate)` — volume semanal
- [ ] 6.1.5 Criar query `getAdvanceRateBySector()` — taxa de avanço por setor de empresa
- [ ] 6.1.6 Criar query `getAdvanceRateByStack()` — taxa de avanço por tecnologia exigida
- [ ] 6.1.7 Criar query `getPeriodComparison(currentStart, currentEnd)` — período atual vs anterior de mesmo tamanho

### 6.2 UI do Dashboard

- [ ] 6.2.1 Criar página `/dashboard`
- [ ] 6.2.2 Criar seletor de período (padrão: últimos 30 dias)
- [ ] 6.2.3 Criar cards de métricas principais (total candidaturas, taxa de resposta, tempo médio)
- [ ] 6.2.4 Criar gráfico de funil de conversão por etapa
- [ ] 6.2.5 Criar gráfico de volume de candidaturas por semana (linha ou barras)
- [ ] 6.2.6 Criar tabela de taxa de avanço por setor
- [ ] 6.2.7 Criar tabela de taxa de avanço por stack
- [ ] 6.2.8 Criar componente de comparativo entre períodos (atual vs anterior)
- [ ] 6.2.9 Exibir aviso de baixa confiança estatística quando total de candidaturas < 10
