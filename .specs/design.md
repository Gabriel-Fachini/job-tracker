# Job Tracker — System Design

## 1. Visão Geral da Arquitetura

Aplicação web local (single-user) composta por três partes:

- **Web App** — Next.js rodando em `localhost:3000`, serve UI e executa lógica server-side via Server Actions e Route Handlers
- **SQLite** — banco de dados local em arquivo único na raiz do projeto
- **Chrome Extension** — extensão Manifest V3 que se comunica com o app via REST API exposta pelo Next.js

Serviços externos de runtime (rodando localmente na máquina do usuário):

- **Ollama** em `localhost:11434` — serve o modelo Gemma para tarefas simples de IA
- **tectonic** — compilador LaTeX instalado no sistema, invocado via `child_process`

Serviço externo remoto:

- **Anthropic API** — Claude para tarefas de IA de alta qualidade

```mermaid
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
  localhost:11434      tectonic CLI    api.anthropic.com
     (Ollama)          (via exec)       (Claude API)

┌──────────────────┐
│ Chrome Extension │──── HTTP POST ────► localhost:3000/api/jobs
└──────────────────┘
```

---

## 2. Stack Técnica

| Camada              | Tecnologia                           | Justificativa                                                                          |
| ------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Framework           | Next.js 15 (App Router) + TypeScript | Full-stack em repositório único, Server Actions eliminam API layer separado para o app |
| Banco de dados      | SQLite + Drizzle ORM                 | Local, zero configuração, type-safe, migrations declarativas                           |
| Estilização         | Tailwind CSS + shadcn/ui             | Componentes acessíveis, customizáveis, sem overhead de design system próprio           |
| IA — alta qualidade | Anthropic API (claude-sonnet)        | Extração de perfil, geração de LaTeX — tarefas que exigem qualidade máxima             |
| IA — local          | Gemma 3 via Ollama                   | Extração de campos de vagas — tarefa repetitiva, zero custo, sem latência de rede      |
| PDF                 | tectonic (compilador LaTeX)          | Compilador LaTeX moderno, auto-download de pacotes, sem instalação full texlive        |
| Extensão            | Chrome Extension Manifest V3         | Padrão atual, suporte a service workers                                                |

---

## 3. Estrutura de Pastas

```tree
job-tracker/
├── src/
│   ├── app/
│   │   ├── (app)/                    # grupo de rotas autenticadas (layout compartilhado)
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── companies/
│   │   │   ├── jobs/
│   │   │   ├── applications/
│   │   │   └── resumes/
│   │   ├── api/
│   │   │   └── jobs/
│   │   │       └── route.ts          # REST endpoint exclusivo para a extensão Chrome
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
│   │   │   ├── claude.ts             # client Anthropic API
│   │   │   └── ollama.ts             # client Ollama local
│   │   └── latex/
│   │       └── compiler.ts           # wrapper tectonic via child_process
│   └── server/
│       └── actions/                  # Server Actions por módulo
│           ├── profile.ts
│           ├── companies.ts
│           ├── jobs.ts
│           ├── applications.ts
│           └── resumes.ts
├── uploads/
│   └── resumes/
│       ├── master/                   # currículo PDF original do usuário
│       └── generated/                # {slug-empresa}-{slug-vaga}-{timestamp}/
│           ├── *.pdf
│           └── *.tex
├── extension/                        # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background.ts                 # service worker
│   ├── content.ts                    # content script (captura DOM)
│   └── popup/                        # UI do popup
├── drizzle.config.ts
├── next.config.ts
└── .env.local                        # ANTHROPIC_API_KEY, DATABASE_URL, UPLOADS_PATH
```

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

// === VAGAS ===

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').references(() => companies.id),
  title: text('title').notNull(),
  seniority: text('seniority'),            // intern | junior | mid | senior | staff | lead
  stack: text('stack'),                    // JSON array
  workModel: text('work_model'),           // remote | hybrid | onsite
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  sourceName: text('source_name'),         // linkedin | gupy | catho | company_site | other
  sourceUrl: text('source_url'),
  description: text('description'),        // descrição completa salva localmente
  deadline: integer('deadline', { mode: 'timestamp' }),
  status: text('status').notNull().default('interesting'), // interesting | applying | applied | discarded
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// === CANDIDATURAS ===

export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  status: text('status').notNull().default('applied'), // applied | in_process | offer | approved | rejected | withdrawn
  recruiterName: text('recruiter_name'),
  recruiterContact: text('recruiter_contact'),
  trackingChannel: text('tracking_channel'), // email | platform | whatsapp | other
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

export const resumes = sqliteTable('resumes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  applicationId: integer('application_id').references(() => applications.id),
  jobId: integer('job_id').references(() => jobs.id), // pode existir sem candidatura
  pdfPath: text('pdf_path').notNull(),
  texPath: text('tex_path').notNull(),
  generationPrompt: text('generation_prompt'), // instruções adicionais do usuário
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
});
```

### Diagrama de Relacionamentos

```mermaid
profile ──< profile_experiences ──< profile_experience_bullets
        ──< profile_skills
        ──< profile_projects
        ──< profile_education

companies ──< jobs ──< applications ──< application_stages
                   │               └──< application_status_history
                   └──< resumes ◄── applications
```

---

## 5. Decisões Server vs Client

| Operação                         | Onde roda                                      | Justificativa                                                       |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Queries ao banco                 | Server (Server Action)                         | Drizzle/SQLite só roda server-side                                  |
| Extração de perfil via Claude    | Server (Server Action)                         | API key não exposta ao client                                       |
| Extração de vaga via Ollama      | Server (Server Action)                         | Ollama em localhost, chamado server-side                            |
| Compilação LaTeX via tectonic    | Server (Server Action)                         | `child_process` só disponível server-side                           |
| Serving de PDF gerado            | Server (Route Handler `GET /api/resumes/[id]`) | Leitura de arquivo do filesystem                                    |
| Recebimento de vaga da extensão  | Server (Route Handler `POST /api/jobs`)        | REST puro, extensão não usa Server Actions                          |
| Estado do Kanban / UI interativa | Client                                         | Estado local de drag-and-drop, atualiza via Server Action ao soltar |
| Filtros e período do dashboard   | Client                                         | Filtros reativos sem round-trip ao servidor; dados já carregados    |

---

## 6. Integração com IA

### 6.1 Claude (Anthropic API) — Tarefas de Alta Qualidade

**Casos de uso:**

- Extração e estruturação do perfil a partir do currículo colado
- Geração do arquivo `.tex` customizado para cada vaga

**Client (`src/lib/ai/claude.ts`):**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = message.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text response from Claude');
  return block.text;
}
```

**Contrato de resposta esperado:** JSON estruturado (perfil) ou string LaTeX (currículo). O system prompt instrui o modelo a retornar apenas o formato esperado, sem prose adicional.

---

### 6.2 Gemma via Ollama — Tarefas Locais

**Casos de uso:**

- Extração de campos de vaga (título, stack, seniority, work model, salary) a partir do texto capturado pela extensão ou colado manualmente

**Client (`src/lib/ai/ollama.ts`):**

```typescript
export async function callOllama(prompt: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma3',
      prompt,
      stream: false,
    }),
  });

  const data = await response.json();
  return data.response;
}
```

**Fallback:** se Ollama não estiver rodando (conexão recusada), o app exibe os campos em branco para preenchimento manual, sem quebrar o fluxo.

---

## 7. Geração de Currículo (LaTeX → PDF)

### Fluxo detalhado

```mermaid
Server Action: generateResume(jobId, additionalInstructions?)
        │
        ├─ 1. Busca perfil completo do banco (todas as tabelas profile_*)
        ├─ 2. Busca descrição da vaga (jobs.description)
        ├─ 3. Chama Claude com perfil + descrição + instruções adicionais
        │      └─ Claude retorna string com conteúdo .tex completo
        ├─ 4. Salva o .tex em uploads/resumes/generated/{slug}/{timestamp}.tex
        ├─ 5. Executa: tectonic {arquivo.tex} --outdir {dir}
        │      └─ via child_process.execFile (timeout: 30s)
        ├─ 6. Verifica se o .pdf foi gerado no outdir
        ├─ 7. Salva registro na tabela resumes
        └─ 8. Retorna { pdfPath, texPath, resumeId }
```

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

---

## 8. API REST (Exclusiva para a Extensão Chrome)

A extensão não pode usar Server Actions (são chamadas internas do Next.js). O único endpoint REST exposto é para recebimento de vagas.

### `POST /api/jobs`

**Request:**

```typescript
{
  url: string;           // URL da página capturada
  rawContent: string;    // texto extraído do DOM pela extensão
  companyName?: string;  // se a extensão conseguir identificar
}
```

**Processamento server-side:**

1. Recebe o payload
2. Chama Ollama para extrair campos estruturados do `rawContent`
3. Cria ou encontra a empresa pelo nome
4. Salva a vaga com status `interesting`
5. Retorna a vaga criada

**Response:**

```typescript
{
  jobId: number;
  job: {
    title: string;
    company: string;
    seniority?: string;
    stack?: string[];
    workModel?: string;
    // ...
  };
  extractionConfidence: 'high' | 'low'; // 'low' se Ollama indisponível
}
```

**Autenticação:** nenhuma (app local, single-user). A extensão não precisa de token.

---

## 9. Chrome Extension

### Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Job Tracker",
  "permissions": ["activeTab", "scripting"],
  "host_permissions": ["http://localhost:3000/*"],
  "action": { "default_popup": "popup/index.html" },
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

### Fluxo da extensão

```mermaid
Usuário clica no ícone da extensão
        │
        ▼
content.js extrai: document.title, location.href, innerText relevante
        │
        ▼
Envia para background.js via chrome.runtime.sendMessage
        │
        ▼
background.js faz POST http://localhost:3000/api/jobs
        │
        ├─ Sucesso → abre popup com campos pré-preenchidos para revisão
        └─ Erro (app não rodando) → popup mostra mensagem de erro
```

### Popup

O popup da extensão exibe os campos extraídos para revisão antes de confirmar. É uma página HTML simples (sem framework) que se comunica com o background via `chrome.runtime.sendMessage`.

---

## 10. Variáveis de Ambiente

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=./job-tracker.db
UPLOADS_PATH=./uploads
OLLAMA_BASE_URL=http://localhost:11434
TECTONIC_PATH=tectonic   # ou path absoluto se não estiver no PATH
```

---

## 11. Ordem de Desenvolvimento

1. **Setup** — Next.js + Drizzle + SQLite + shadcn/ui + migrations iniciais
2. **Módulo Perfil** — upload PDF + extração via Claude + formulário de revisão
3. **Módulo Empresas + Vagas** — CRUD completo, registro manual
4. **Geração de currículo** — integração Claude + tectonic + serving do PDF
5. **Módulo Candidaturas** — Kanban + timeline de etapas
6. **Dashboard + Analytics** — queries de funil + gráficos
7. **Extensão Chrome** — captura + POST /api/jobs + popup de revisão
