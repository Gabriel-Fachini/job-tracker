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

---

## Fase 2 — Módulo Perfil

### 2.1 Integração local com `ollama.cpp`

- [x] 2.1.1 Criar client do runtime local em `src/lib/ai/ollama.ts`
- [x] 2.1.2 Definir configuração mínima do modelo local (`OLLAMA_CPP_BASE_URL`, `OLLAMA_CPP_MODEL`)
- [x] 2.1.3 Criar função `extractProfileFromText(rawText: string)` que chama o modelo local e retorna JSON estruturado do perfil
- [x] 2.1.4 Validar e tipar o JSON retornado pelo modelo local contra o schema do banco

### 2.2 Comparação com GPT da OpenAI

- [ ] 2.2.1 Instalar OpenAI SDK (`openai`)
- [ ] 2.2.2 Criar client OpenAI em `src/lib/ai/openai.ts`
- [ ] 2.2.3 Criar utilitário `compareProfileExtraction(rawText: string)` que rode o mesmo input no fluxo local e em um modelo GPT da OpenAI
- [ ] 2.2.4 Definir formato local de comparação para inspeção manual dos resultados (ex. JSON com input, output local, output OpenAI e observações)
- [ ] 2.2.5 Garantir que a comparação seja opcional e não bloqueie o fluxo principal do produto

### 2.3 Upload e extração

- [ ] 2.3.1 Criar página `/profile`
- [ ] 2.3.2 Criar componente de upload de PDF (currículo master)
- [ ] 2.3.3 Criar Route Handler `POST /api/profile/upload` para receber o PDF, salvar em `uploads/resumes/master/` e extrair texto
- [ ] 2.3.4 Criar Server Action `extractProfile(rawText)` que chama o modelo local e persiste o perfil estruturado no banco
- [ ] 2.3.5 Permitir acionar comparação opcional com OpenAI após a extração principal
- [ ] 2.3.6 Exibir loading state durante extração

### 2.4 Formulário de revisão

- [ ] 2.4.1 Criar seção de identidade e contato (campos editáveis)
- [ ] 2.4.2 Criar seção de experiências profissionais com lista de bullets editáveis por cargo
- [ ] 2.4.3 Criar seção de habilidades com nível e categoria
- [ ] 2.4.4 Criar seção de projetos pessoais
- [ ] 2.4.5 Criar seção de formação acadêmica
- [ ] 2.4.6 Criar seção de preferências (modelo de trabalho, tipo de empresa, valores)
- [ ] 2.4.7 Criar Server Action `updateProfile(data)` para persistir edições
- [ ] 2.4.8 Permitir adicionar/remover experiências, bullets, habilidades e projetos manualmente

---

## Fase 3 — Módulo Empresas e Vagas

### 3.1 Empresas

- [ ] 3.1.1 Criar página `/companies` com listagem em tabela
- [ ] 3.1.2 Criar página `/companies/new` com formulário de cadastro
- [ ] 3.1.3 Criar página `/companies/[id]` com detalhes e vagas associadas
- [ ] 3.1.4 Criar Server Actions: `createCompany`, `updateCompany`, `deleteCompany`
- [ ] 3.1.5 Implementar atualização automática de status da empresa quando candidatura associada muda de status

### 3.2 Vagas — Registro manual

- [ ] 3.2.1 Criar página `/jobs` com listagem e filtros por status
- [ ] 3.2.2 Criar página `/jobs/new` com textarea para colar descrição + formulário de campos
- [ ] 3.2.3 Reusar client local baseado em `ollama.cpp` em `src/lib/ai/ollama.ts`
- [ ] 3.2.4 Criar Server Action `extractJobFields(rawText)` que chama o modelo local
- [ ] 3.2.5 Implementar fallback: se o runtime local indisponível, exibir campos em branco sem quebrar o fluxo
- [ ] 3.2.6 Criar página `/jobs/[id]` com detalhes da vaga e descrição completa salva
- [ ] 3.2.7 Criar Server Actions: `createJob`, `updateJob`, `deleteJob`
- [ ] 3.2.8 Ao criar vaga, salvar descrição completa no banco independentemente dos outros campos

---

## Fase 4 — Geração de Currículo

### 4.1 Compilador LaTeX

- [ ] 4.1.1 Verificar instalação do `tectonic` na máquina e documentar pré-requisito no README
- [ ] 4.1.2 Criar wrapper `src/lib/latex/compiler.ts` invocando `tectonic` via `child_process.execFile`
- [ ] 4.1.3 Implementar timeout de 30s e captura de stderr para erros de compilação
- [ ] 4.1.4 Validar que o PDF foi gerado no outdir após execução

### 4.2 Geração via IA

- [ ] 4.2.1 Criar Server Action `generateResume(jobId, additionalInstructions?)` com o fluxo completo descrito no System Design
- [ ] 4.2.2 Criar prompt de sistema para o modelo local que instrui geração de `.tex` completo a partir do perfil e descrição da vaga
- [ ] 4.2.3 Definir convenção de nomes dos arquivos gerados: `{slug-empresa}-{slug-vaga}-{timestamp}`
- [ ] 4.2.4 Salvar `.tex` e `.pdf` em `uploads/resumes/generated/{slug}/`
- [ ] 4.2.5 Persistir registro na tabela `resumes` com paths e prompt usado

### 4.3 UI de geração

- [ ] 4.3.1 Criar página `/resumes` com histórico de currículos gerados
- [ ] 4.3.2 Criar componente de geração acessível a partir da página de vaga e de candidatura
- [ ] 4.3.3 Adicionar campo de instruções adicionais (textarea opcional)
- [ ] 4.3.4 Implementar loading state síncrono durante geração e compilação
- [ ] 4.3.5 Criar Route Handler `GET /api/resumes/[id]/pdf` para serving do arquivo PDF gerado
- [ ] 4.3.6 Exibir link para download do PDF após geração

---

## Fase 5 — Módulo Candidaturas

### 5.1 Board Kanban

- [ ] 5.1.1 Criar página `/applications` com board Kanban
- [ ] 5.1.2 Implementar colunas: `Aplicado | Em Processo | Oferta | Aprovado | Rejeitado | Desistiu`
- [ ] 5.1.3 Implementar drag-and-drop entre colunas (estado client-side)
- [ ] 5.1.4 Ao soltar card em nova coluna, chamar Server Action `updateApplicationStatus(id, newStatus)`
- [ ] 5.1.5 Server Action deve registrar entrada em `application_status_history` automaticamente

### 5.2 Detalhes da candidatura

- [ ] 5.2.1 Criar página `/applications/[id]` com detalhes completos
- [ ] 5.2.2 Criar componente de timeline de etapas (label + data + notas)
- [ ] 5.2.3 Implementar adição de nova etapa via formulário inline
- [ ] 5.2.4 Criar Server Actions: `createApplicationStage`, `updateApplicationStage`, `deleteApplicationStage`
- [ ] 5.2.5 Exibir currículo usado com link para download
- [ ] 5.2.6 Criar seção de contatos de RH (nome, cargo, email, LinkedIn)
- [ ] 5.2.7 Criar campo de canal de acompanhamento
- [ ] 5.2.8 Criar Server Actions: `createApplication`, `updateApplication`

### 5.3 Criação de candidatura

- [ ] 5.3.1 Ao marcar vaga como `Aplicando` ou `Aplicada`, oferecer criação de candidatura automaticamente
- [ ] 5.3.2 Associar currículo gerado mais recente para a vaga à candidatura criada (sugestão, editável)

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
- [ ] 6.2.3 Criar cards de métricas principais (total aplicações, taxa de resposta, tempo médio)
- [ ] 6.2.4 Criar gráfico de funil de conversão por etapa
- [ ] 6.2.5 Criar gráfico de volume de aplicações por semana (linha ou barras)
- [ ] 6.2.6 Criar tabela de taxa de avanço por setor
- [ ] 6.2.7 Criar tabela de taxa de avanço por stack
- [ ] 6.2.8 Criar componente de comparativo entre períodos (atual vs anterior)
- [ ] 6.2.9 Exibir aviso de baixa confiança estatística quando total de candidaturas < 10

---

## Fase 7 — Extensão Chrome

### 7.1 Setup da extensão

- [ ] 7.1.1 Criar pasta `extension/` na raiz do projeto
- [ ] 7.1.2 Criar `manifest.json` com Manifest V3 conforme System Design
- [ ] 7.1.3 Configurar build da extensão (esbuild ou vite para transpilar TypeScript)
- [ ] 7.1.4 Documentar no README como carregar a extensão em modo developer no Chrome

### 7.2 Captura de conteúdo

- [ ] 7.2.1 Criar `content.ts` que extrai `document.title`, `location.href` e texto relevante do DOM
- [ ] 7.2.2 Registrar listener para mensagem de captura enviada pelo background
- [ ] 7.2.3 Criar `background.ts` (service worker) que recebe mensagem do content script e faz POST para `localhost:3000/api/jobs`
- [ ] 7.2.4 Tratar erro de conexão quando o app não estiver rodando

### 7.3 Route Handler no Next.js

- [ ] 7.3.1 Criar `src/app/api/jobs/route.ts` com handler `POST`
- [ ] 7.3.2 Receber payload `{ url, rawContent, companyName? }`
- [ ] 7.3.3 Chamar o runtime local baseado em `ollama.cpp` para extrair campos estruturados do `rawContent`
- [ ] 7.3.4 Criar ou localizar empresa pelo nome extraído
- [ ] 7.3.5 Persistir vaga com status `interesting`
- [ ] 7.3.6 Retornar `{ jobId, job, extractionConfidence }` conforme contrato do System Design
- [ ] 7.3.7 Configurar CORS para aceitar requisições da extensão (`chrome-extension://`)

### 7.4 Popup da extensão

- [ ] 7.4.1 Criar `extension/popup/index.html` com formulário de revisão dos campos extraídos
- [ ] 7.4.2 Pré-preencher campos com dados retornados pelo POST
- [ ] 7.4.3 Exibir indicador de confiança da extração (`extractionConfidence`)
- [ ] 7.4.4 Adicionar botão "Abrir no app" que abre `localhost:3000/jobs/{jobId}` em nova aba
- [ ] 7.4.5 Exibir mensagem de erro quando app não estiver acessível
