# Job Tracker — System Design

## 1. Visão Geral da Arquitetura

Aplicação web local (single-user) composta por:

- **Web App** — Next.js rodando em `localhost:3000`, serve UI e executa lógica server-side via Server Actions e Route Handlers
- **SQLite** — banco de dados local em arquivo único na raiz do projeto

Serviços externos de runtime:

- **Runtime principal do Ollama** — configurável por ambiente (`local` em `localhost:11434` ou `cloud` com API key) e usado como fonte principal de IA do produto para extração e geração
- **tectonic** — compilador LaTeX instalado no sistema, invocado via `child_process`

Serviço externo remoto:

- **OpenAI API** — usada apenas para comparação de outputs com modelos GPT durante esta fase do projeto

```
┌─────────────────────────────────────────────────┐
│                  localhost:3000                  │
│                                                  │
│   ┌──────────────┐      ┌─────────────────────┐ │
│   │   React UI   │◄────►│  Server Actions /   │ │
│   │  (Client)    │      │  Route Handlers     │ │
│   └──────────────┘      └────────┬────────────┘ │
│                                  │               │
│              ┌───────────────────┼─────────────┐ │
│              │                   │             │ │
│        ┌─────▼──────┐   ┌───────▼──────┐      │ │
│        │   SQLite   │   │  File System │      │ │
│        │  (Drizzle) │   │  (uploads/)  │      │ │
│        └────────────┘   └─────────────┘      │ │
│                                               │ │
└───────────────────────────────────────────────┘─┘
         │                    │              │
         ▼                    ▼              ▼
 Ollama local/cloud     tectonic CLI      api.openai.com
   (principal)          (via exec)     (benchmark GPT)
         │
         ▼
  APIs públicas de plataformas
  (Gupy, Greenhouse, Lever...)
  + fetch genérico como fallback
```

---

## 2. Stack Técnica

| Camada              | Tecnologia                           | Justificativa                                                                          |
| ------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Framework           | Next.js 16 (App Router) + TypeScript | Full-stack em repositório único, Server Actions eliminam API layer separado para o app |
| Banco de dados      | SQLite + Drizzle ORM                 | Local, zero configuração, type-safe, migrations declarativas                           |
| Estilização         | Tailwind CSS + shadcn/ui             | Componentes acessíveis, customizáveis, sem overhead de design system próprio           |
| IA — principal      | Runtime Ollama configurável (`local` ou `cloud`) | Fonte principal do produto para extração de perfil, extração de vagas e geração textual |
| IA — comparação     | OpenAI API (modelos GPT)             | Benchmark pontual de qualidade com o mesmo input, sem virar dependência primária        |
| Scraping — APIs     | `fetch` nativo (Node.js)             | Plataformas com API pública (Gupy, Greenhouse, Lever): dados estruturados direto, sem parsing |
| Scraping — genérico | `fetch` + `cheerio`                  | Plataformas sem API: extrai texto do HTML; IA processa os campos                       |
| PDF                 | tectonic (compilador LaTeX)          | Compilador LaTeX moderno, auto-download de pacotes, sem instalação full texlive        |

---

## 3. Estrutura de Pastas

```tree
job-tracker/
├── src/
│   ├── app/
│   │   ├── (app)/                    # grupo de rotas com layout compartilhado (sidebar)
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── companies/
│   │   │   └── applications/         # listagem (kanban) + modal deep-linkável `?applicationId=` (detalhes + currículos gerados)
│   │   ├── api/
│   │   │   └── resumes/
│   │   │       └── [id]/
│   │   │           └── route.ts      # GET — serving do PDF gerado
│   │   ├── layout.tsx
│   │   └── page.tsx                  # redireciona para /dashboard
│   ├── components/
│   │   ├── ui/                       # componentes shadcn/ui
│   │   └── [feature]/                # componentes por módulo
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts             # definição das tabelas Drizzle
│   │   │   ├── migrations/           # arquivos de migration gerados
│   │   │   └── index.ts              # instância do client SQLite
│   │   ├── ai/
│   │   │   ├── ollama.ts             # client do runtime principal do Ollama
│   │   │   ├── openai.ts             # client OpenAI usado só para comparação
│   │   │   └── comparison.ts         # orquestra comparação lado a lado entre outputs
│   │   ├── scraper/
│   │   │   ├── index.ts              # entry point: detecta plataforma e delega ao extrator correto
│   │   │   ├── registry.ts           # mapeia domínio → função extratora
│   │   │   ├── platforms/
│   │   │   │   ├── gupy.ts           # API client: api.gupy.io/api/v1/jobs/{id}
│   │   │   │   ├── greenhouse.ts     # API client: boards-api.greenhouse.io/...
│   │   │   │   ├── lever.ts          # API client: api.lever.co/v0/postings/...
│   │   │   │   └── generic.ts        # fetch + cheerio → texto bruto → IA extrai campos
│   │   │   └── types.ts              # ExtractedJob — contrato comum de saída
│   │   └── latex/
│   │       └── compiler.ts           # wrapper tectonic via child_process
│   └── server/
│       └── actions/                  # Server Actions por módulo
│           ├── profile.ts
│           ├── companies.ts
│           ├── applications.ts       # inclui scrapeAndExtractJob e createApplication
│           └── resumes.ts            # geração de currículo (tex + pdf) vinculada à candidatura
├── uploads/
│   └── resumes/
│       ├── master/                   # currículo PDF original do usuário
│       └── generated/                # {slug-empresa}-{slug-vaga}-{timestamp}/
│           ├── *.pdf
│           └── *.tex
├── drizzle.config.ts
├── next.config.ts
└── .env.local
```

> **Nota:** não existe rota `/resumes`. O histórico de currículos gerados é exibido dentro do modal de detalhes em `/applications?applicationId=...`.

---

## 4. Banco de Dados

### Schema completo (Drizzle/SQLite)

```typescript
// === PERFIL ===

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  linkedin: text('linkedin'),
  github: text('github'),
  location: text('location'),
  workModelPreference: text('work_model_preference'), // remote | hybrid | onsite
  notes: text('notes'),
  masterResumePath: text('master_resume_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const profileExperiences = sqliteTable('profile_experiences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profile.id),
  company: text('company').notNull(),
  role: text('role').notNull(),
  startDate: text('start_date').notNull(), // YYYY-MM
  endDate: text('end_date'),               // YYYY-MM | null se atual
  isCurrent: integer('is_current', { mode: 'boolean' }).default(false),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const profileExperienceBullets = sqliteTable('profile_experience_bullets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  experienceId: integer('experience_id').notNull().references(() => profileExperiences.id),
  content: text('content').notNull(),
  tags: text('tags'),                      // JSON array: ["node", "performance", "achievement"]
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const profileSkills = sqliteTable('profile_skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profile.id),
  name: text('name').notNull(),
  level: text('level'),                    // beginner | intermediate | advanced | expert
  yearsExperience: integer('years_experience'),
  category: text('category'),              // language | framework | tool | soft-skill
});

export const profileProjects = sqliteTable('profile_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profile.id),
  name: text('name').notNull(),
  description: text('description'),
  stack: text('stack'),                    // JSON array
  url: text('url'),
  impact: text('impact'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const profileEducation = sqliteTable('profile_education', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profile.id),
  institution: text('institution').notNull(),
  degree: text('degree'),
  field: text('field'),
  startDate: text('start_date'),
  endDate: text('end_date'),
});

// === EMPRESAS ===

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  website: text('website'),
  sector: text('sector'),
  size: text('size'),                      // startup | small | medium | large | enterprise
  jobsBoardUrl: text('jobs_board_url'),
  glassdoorUrl: text('glassdoor_url'),
  status: text('status').notNull().default('monitoring'), // monitoring | in_process | discarded | blacklist
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// === CANDIDATURAS ===
// Os dados da vaga ficam embutidos na candidatura.
// Não existe tabela separada de vagas.

export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // --- dados da vaga ---
  companyId: integer('company_id').notNull().references(() => companies.id), // obrigatório
  jobTitle: text('job_title').notNull(),
  seniority: text('seniority'),            // intern | junior | mid | senior | staff | lead
  stack: text('stack'),                    // JSON array
  workModel: text('work_model'),           // remote | hybrid | onsite
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  sourceName: text('source_name'),         // linkedin | gupy | catho | company_site | other
  sourceUrl: text('source_url'),           // URL original da vaga
  description: text('description'),        // descrição completa salva localmente
  deadline: integer('deadline', { mode: 'timestamp' }),

  // --- dados do processo ---
  status: text('status').notNull().default('applied'), // applied | in_process | offer | approved | rejected | withdrawn
  recruiterName: text('recruiter_name'),
  recruiterContact: text('recruiter_contact'),
  trackingChannel: text('tracking_channel'), // email | platform | whatsapp | other
  usedResumeStatus: text('used_resume_status').notNull().default('unknown'), // unknown | uploaded | empty
  usedResumePath: text('used_resume_path'),  // PDF manual efetivamente enviado na candidatura
  usedResumeOriginalFilename: text('used_resume_original_filename'),
  notes: text('notes'),
  appliedAt: integer('applied_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const applicationStages = sqliteTable('application_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  applicationId: integer('application_id').notNull().references(() => applications.id),
  label: text('label').notNull(),          // string livre: "Teste técnico", "Entrevista CTO"
  date: integer('date', { mode: 'timestamp' }).notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const applicationStatusHistory = sqliteTable('application_status_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  applicationId: integer('application_id').notNull().references(() => applications.id),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedAt: integer('changed_at', { mode: 'timestamp' }).notNull(),
});

// === CURRÍCULOS GERADOS ===
// Vinculados à candidatura. Exibidos dentro da página de detalhes da candidatura.
// Não existe página /resumes separada.

export const resumes = sqliteTable('resumes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  applicationId: integer('application_id').notNull().references(() => applications.id),
  pdfPath: text('pdf_path').notNull(),
  texPath: text('tex_path').notNull(),
  generationPrompt: text('generation_prompt'), // instruções adicionais do usuário
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
});
```

### Diagrama de Relacionamentos

```
profile ──< profile_experiences ──< profile_experience_bullets
        ──< profile_skills
        ──< profile_projects
        ──< profile_education

companies ──< applications ──< application_stages
                           └──< application_status_history
                           └──< resumes
```

---

## 5. Decisões Server vs Client

| Operação                                  | Onde roda                                        | Justificativa                                                       |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Queries ao banco                          | Server (Server Action)                           | Drizzle/SQLite só roda server-side                                  |
| Extração de perfil via runtime principal do Ollama | Server (Server Action)                     | Runtime Ollama configurado por ambiente, chamado server-side        |
| Comparação com GPT da OpenAI              | Server (Server Action)                           | API key não exposta ao client; fluxo auxiliar de benchmark          |
| Scraping de URL de vaga via Playwright    | Server (Server Action)                           | Playwright roda server-side; browser headless não disponível no client |
| Extração de campos de vaga via runtime principal do Ollama | Server (Server Action)               | Runtime Ollama configurado por ambiente, chamado server-side        |
| Compilação LaTeX via tectonic             | Server (Server Action)                           | `child_process` só disponível server-side                           |
| Serving de PDF gerado                     | Server (Route Handler `GET /api/resumes/[id]`)   | Leitura de arquivo do filesystem                                    |
| Estado do Kanban / UI interativa          | Client                                           | Estado local de drag-and-drop, atualiza via Server Action ao soltar |
| Filtros e período do dashboard            | Client                                           | Filtros reativos sem round-trip ao servidor; dados já carregados    |

---

## 6. Integração com IA

### 6.1 Runtime principal do Ollama — Fonte principal do produto

**Casos de uso:**

- Extração e estruturação do perfil a partir do currículo colado
- Extração de campos de candidatura a partir de texto scrapeado ou colado manualmente
- Geração do arquivo `.tex` customizado para cada candidatura

**Client (`src/lib/ai/ollama.ts`):**

```typescript
export async function callOllamaLlm(prompt: string, system?: string): Promise<string> {
  const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.OLLAMA_RUNTIME_MODE === 'cloud' && process.env.OLLAMA_API_KEY
        ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL,
      system,
      prompt,
      stream: false,
    }),
  });

  const data = await response.json();
  return data.response;
}
```

**Contrato de resposta esperado:** JSON estruturado (perfil/candidatura) ou string LaTeX (currículo). O system prompt instrui o modelo a retornar apenas o formato esperado, sem prose adicional.

---

### 6.2 OpenAI GPT — Comparação de outputs

**Casos de uso:**

- Rodar o mesmo input do fluxo principal em um modelo GPT da OpenAI
- Comparar aderência estrutural e qualidade textual do output local contra o output remoto
- Apoiar decisão futura de prompt, modelo principal do Ollama e critérios de qualidade

**Client (`src/lib/ai/openai.ts`):**

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function callOpenAiForComparison(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await client.responses.create({
    model: process.env.OPENAI_COMPARISON_MODEL ?? 'gpt-4.1',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  return response.output_text;
}
```

**Regra:** OpenAI entra como trilha comparativa, opcional e desligável. O fluxo principal do produto continua funcional sem ela.

**Fallback:** se o runtime principal do Ollama estiver indisponível, o app deve falhar de forma explícita nos fluxos que dependem de IA principal ou, quando o fluxo permitir, exibir campos em branco para preenchimento manual sem quebrar a operação.

---

## 7. Scraping de URL de Vaga

**Objetivo:** o usuário cola a URL de uma vaga e o sistema extrai automaticamente o conteúdo para preencher os campos da candidatura, sem precisar de IA quando a plataforma já expõe uma API pública.

### Arquitetura: Registry de plataformas

A lógica de extração vive inteiramente em código. Não existe entidade de banco para plataformas — adicionar suporte a uma nova plataforma significa criar um arquivo em `platforms/` e uma linha no registry.

**`src/lib/scraper/registry.ts`:**

```typescript
import { extractGupy }       from './platforms/gupy'
import { extractGreenhouse } from './platforms/greenhouse'
import { extractLever }      from './platforms/lever'
import { extractGeneric }    from './platforms/generic'

type Extractor = (url: string) => Promise<ExtractedJob>

const REGISTRY: Record<string, Extractor> = {
  'gupy.io':       extractGupy,
  'greenhouse.io': extractGreenhouse,
  'lever.co':      extractLever,
}

export function getExtractor(url: string): Extractor {
  const domain = new URL(url).hostname.replace('www.', '')
  const match = Object.keys(REGISTRY).find(d => domain.endsWith(d))
  return match ? REGISTRY[match] : extractGeneric
}
```

**`src/lib/scraper/index.ts` — entry point:**

```typescript
export async function scrapeAndExtract(url: string): Promise<ExtractedJob> {
  const extractor = getExtractor(url)
  return extractor(url)
}
```

**`src/lib/scraper/types.ts` — contrato comum de saída:**

```typescript
export type ExtractedJob = {
  jobTitle:     string | null
  companyName:  string | null   // para localizar/criar empresa
  seniority:    string | null
  stack:        string[] | null
  workModel:    string | null
  salaryMin:    number | null
  salaryMax:    number | null
  description:  string | null   // sempre salvo se extraído
  deadline:     string | null
  sourceUrl:    string          // URL original, sempre presente
  sourceName:   string          // nome da plataforma detectada (ex: 'gupy', 'generic')
}
```

### Estratégias por plataforma

**Plataformas com API pública** (`platforms/gupy.ts`, `greenhouse.ts`, `lever.ts`):

```
URL → extrair ID/slug da URL → GET na API pública → mapear JSON → ExtractedJob
```

Sem parsing de HTML, sem IA. Dados estruturados e limpos direto da fonte.

Exemplo Gupy:
```typescript
// URL: https://empresa.gupy.io/jobs/12345
// API:  https://api.gupy.io/api/v1/jobs/12345
export async function extractGupy(url: string): Promise<ExtractedJob> {
  const jobId = url.match(/\/jobs\/(\d+)/)?.[1]
  const data = await fetch(`https://api.gupy.io/api/v1/jobs/${jobId}`).then(r => r.json())
  return {
    jobTitle:    data.name,
    companyName: data.careerPageName,
    description: data.description,
    workModel:   data.workplaceType,
    // ...
  }
}
```

**Fallback genérico** (`platforms/generic.ts`):

```
URL → fetch → cheerio extrai texto limpo → runtime principal do Ollama extrai campos → ExtractedJob
```

Usado para qualquer plataforma não mapeada. Campos não encontrados pelo modelo retornam `null`.

### Fluxo da Server Action

```
Server Action: scrapeAndExtractJob(url)
        │
        ├─ 1. Chama scrapeAndExtract(url) — delega ao extrator correto via registry
        ├─ 2. Recebe ExtractedJob com campos preenchidos (null onde não encontrou)
        ├─ 3. Se companyName presente, localiza ou cria a empresa no banco
        └─ 4. Retorna ExtractedJob para a UI exibir o formulário de revisão
```

**Fallback de erro:** se o extrator falhar (URL inacessível, timeout, resposta inválida), a Server Action retorna `ExtractedJob` com todos os campos `null` e `sourceUrl` preenchida — o usuário preenche manualmente sem quebrar o fluxo.

### Plataformas suportadas (MVP)

| Plataforma | Estratégia | Notas |
|---|---|---|
| Qualquer job board HTML | `fetch` + `cheerio` + IA | Caminho padrão para boards com HTML acessível |
| Job board com paginação client-side | Browser headless genérico | Opt-in manual por empresa via `jobBoardNavigationMode=browser` |

---

## 8. Radar Manual de Vagas

**Objetivo:** varrer empresas com `jobsBoardUrl` válido, descobrir vagas e alimentar uma caixa de triagem separada de `applications`.

### Persistência

Criar tabela `job_leads` com:

- `companyId`
- `title`
- `sourceUrl`
- `sourceName`
- `description`
- `workModel`
- `seniority`
- `locationText`
- `salaryText`
- `classificationStatus`
- `classificationScore`
- `classificationReason`
- `userDecision`
- `userDecisionAt`
- `promotedToApplicationId`
- `discoveredAt`
- `updatedAt`

Regra de unicidade lógica: `companyId + sourceUrl`.

Expandir `companies` com:

- `jobBoardNavigationMode` (`fetch | browser`, default `fetch`)

### Pipeline

`runCompanyMonitoring(companyId)`:

1. Busca empresa e valida `jobsBoardUrl`
2. `discoverJobLinks()` escolhe a estratégia com base em `company.jobBoardNavigationMode`
3. Em `fetch`, segue links de paginação estáticos quando houver `rel=next`, `?page=` ou URL equivalente
4. Em `browser`, abre o job board com browser headless genérico, coleta links visíveis e avança paginação client-side até o fim ou até o limite de segurança
5. `extractJobDetail()` extrai título, descrição e metadados por `JobPosting`, `meta` e HTML semântico
6. `classifyJobLead()` usa o perfil salvo, sinais estruturados em PT-BR, feedback implícito recente e o runtime principal do Ollama para decidir `interesting | review | discarded`
7. Apenas `interesting` e `review` viram `job_leads`

### UI

- Nova rota `/leads` para triagem com abas `Triagem` e `Aprovados`
- Botão `Rodar varredura` em `/companies` e `/companies/[id]`
- Aprovação manual do lead antes da criação efetiva da candidatura
- Promoção manual de lead aprovado para candidatura reaproveitando o shape legado `jobs + applications`

### Restrições do MVP

- Sem scheduler
- Browser headless só para discovery/paginação quando a empresa estiver marcada como `browser`
- Sem scraping automatizado de LinkedIn
- Descartes automáticos não precisam ser persistidos

---

## 9. Geração de Currículo (LaTeX → PDF)

### Fluxo detalhado

```
Server Action: generateResume(applicationId, additionalInstructions?)
        │
        ├─ 1. Busca perfil completo do banco (todas as tabelas profile_*)
        ├─ 2. Busca descrição da candidatura (applications.description)
        ├─ 3. Chama o runtime principal do Ollama com perfil + descrição + instruções adicionais
        │      └─ Ollama retorna string com conteúdo .tex completo
        ├─ 4. Salva o .tex em uploads/resumes/generated/{slug}/{timestamp}.tex
        ├─ 5. Executa: tectonic {arquivo.tex} --outdir {dir}
        │      └─ via child_process.execFile (timeout: 30s)
        ├─ 6. Verifica se o .pdf foi gerado no outdir
        ├─ 7. Salva registro na tabela resumes (vinculado à applicationId)
        └─ 8. Retorna { pdfPath, texPath, resumeId }
```

O currículo gerado aparece na seção de currículos do modal de detalhes em `/applications?applicationId=...`. Não existe rota `/resumes`.

### Wrapper tectonic (`src/lib/latex/compiler.ts`)

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function compileLaTeX(texPath: string, outDir: string): Promise<string> {
  await execFileAsync('tectonic', [texPath, '--outdir', outDir], {
    timeout: 30_000,
  });

  const pdfPath = texPath.replace('.tex', '.pdf').replace(texPath, outDir);
  return pdfPath;
}
```

### Route Handler para serving do PDF

`GET /api/resumes/[id]` — lê o `pdfPath` do banco e serve o arquivo.

---

## 10. Variáveis de Ambiente

```bash
# .env.local
DATABASE_URL=./job-tracker.db
UPLOADS_PATH=./uploads
OLLAMA_RUNTIME_MODE=local
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:latest
OLLAMA_API_KEY=ollama_...   # obrigatório quando OLLAMA_RUNTIME_MODE=cloud
OLLAMA_TIMEOUT_MS=240000
OPENAI_API_KEY=sk-...
OPENAI_COMPARISON_MODEL=gpt-4.1
TECTONIC_PATH=tectonic   # ou path absoluto se não estiver no PATH
```

---

## 11. Ordem de Desenvolvimento

1. **Setup** — Next.js + Drizzle + SQLite + shadcn/ui + migrations iniciais
2. **Módulo Perfil** — upload PDF + extração via runtime principal do Ollama + formulário de revisão
3. **Módulo Empresas** — CRUD
4. **Módulo Candidaturas** — registro (URL scraping com registry + manual), Kanban, timeline de etapas
5. **Radar manual de vagas** — descoberta genérica via `fetch + cheerio` + triagem com sinais PT-BR + Ollama
6. **Geração de currículo** — integração principal com Ollama + tectonic + serving do PDF dentro da candidatura
7. **Dashboard + Analytics** — queries de funil + gráficos
