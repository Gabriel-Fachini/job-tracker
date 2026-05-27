# Job Tracker - Project Context

## Stack

- Next.js (App Router) + TypeScript
- SQLite + Drizzle ORM (`src/lib/db/schema.ts`)
- TanStack Query para client-side state de leads
- SSE (`EventSource`) para progresso real-time do radar
- Ollama (cloud mode) para classificação de leads
- OpenAI (opcional) para formatação de job descriptions

## AI Runtime — Ollama Cloud

`OLLAMA_RUNTIME_MODE=cloud` — classificação roda via HTTP remoto, não local.

**Env vars obrigatórias:**

| Var | Descrição |
|-----|-----------|
| `OLLAMA_RUNTIME_MODE` | `cloud` ou `local` |
| `OLLAMA_BASE_URL` | URL base da API Ollama |
| `OLLAMA_MODEL` | Nome do modelo (ex: `gemma3:4b`) |
| `OLLAMA_API_KEY` | API key para autenticação cloud |
| `OLLAMA_TIMEOUT_MS` | Timeout por request (default: `240000`) |

Ambos `extractJobDetail` (HTTP fetch ao job board) e `classifyJobLead` (HTTP ao Ollama cloud) são I/O bound. Paralelização segura: links processados em concurrent batch com `pLimit(5)` (`LINK_PROCESSING_CONCURRENCY` em `src/lib/job-monitoring/index.ts:16`).

**Ganho de performance:** ~80% em boards extensos. ~2s/link → ~100s sequencial para 50 links → ~20s paralelo.

## Radar de Vagas (Monitoramento)

Fluxo quando usuário dispara o radar:

1. `POST /api/monitoring/stream` abre SSE stream via `EventSource`
2. Para cada empresa monitorada, `runMonitoringForCompany()` busca links do job board
3. Cada link: **Phase 1 colapsada** — extração + classificação + upsert em paralelo dentro do mesmo `pLimit` callback (sem Phase 2 separada)
4. Após cada link: emite evento `link-done` com decisão (`interesting`, `review`, `discarded`)
5. Final de empresa: emite `company-done`. Final geral: `all-done`

**SSE events:** `start`, `company-start`, `link-done`, `company-done`, `all-done`, `error`

**Arquivos-chave:**
- `src/app/api/monitoring/stream/route.ts` — Route Handler SSE
- `src/app/api/monitoring/current/route.ts` — GET snapshot do run atual
- `src/lib/job-monitoring/index.ts` — pipeline de processamento
- `src/lib/job-monitoring/run-state.ts` — estado in-memory do run

## Página de Leads (TanStack Query)

**Fluxo de dados:**

1. `leads/page.tsx` (Server Component) faz query Drizzle direta → passa `items` como `initialData` para `LeadsClient`
2. `LeadsClient` usa `useQuery({ queryKey: ["leads"], queryFn: getLeads, initialData: items, staleTime: 30_000 })`
3. `getLeads()` é Server Action em `src/server/actions/leads.ts` — sem route handler `/api/leads`
4. `MonitoringProgressContext` escuta SSE e chama `queryClient.invalidateQueries({ queryKey: ["leads"] })` a cada `link-done` com `decision !== "discarded"`

**Decisões arquiteturais:**
- `initialData` (não `placeholderData`) → zero loading flicker no primeiro render
- `staleTime: 30_000` → sem refetch desnecessário durante scan
- Invalidação apenas para `interesting`/`review` → descartados não aparecem no board
- `QueryProvider` deve envolver `MonitoringProgressProvider` no layout (hierarquia de providers)

**Arquivos-chave:**
- `src/app/(app)/leads/page.tsx` — Server Component com query inicial
- `src/components/leads/leads-client.tsx` — useQuery + UI
- `src/components/leads/monitoring-progress-context.tsx` — SSE listener + invalidação
- `src/providers/query-provider.tsx` — QueryClientProvider
- `src/server/actions/leads.ts` — Server Actions de leads

## Job Description Formatting

**OpenAI opcional:**
- `OPENAI_FORMAT_JOB_DESCRIPTIONS=true|false` (default: `false`)
- Quando ativo, descriptions sem estrutura markdown são reformatadas via `gpt-4o-mini` na Phase 1
- Non-blocking: erros de formato logam e mantêm description original

## Database

**Antes de qualquer migration ou alteração no schema:**

```bash
npm run db:backup
```

- Backups automáticos diários às 03:00 via launchd (7 diários, 4 semanais, 3 mensais)
- Restore: `npm run db:restore backups/daily/job-tracker-YYYY-MM-DD.db.gz`
- Migrations: `npm run db:generate` → `npm run db:migrate`

## Dev Server

- App roda **sempre** na porta 3000 (usuário mantém processo ativo)
- **Nunca** executar `npm run dev` para testar — server já está rodando
- Se iniciar servidor de dev durante conversa para verificar algo, **encerrá-lo ao terminar**
- Se server não responder, pedir ao usuário iniciar antes de prosseguir

## Architecture Notes

- No background processes (manual triggers only)
- No cron scheduling (future feature)
- SQLite WAL mode suporta concurrent writes — `pLimit(5)` estável; reduzir para 3 se `SQLITE_BUSY`
- SSE suficiente para real-time UX sem separação de processos
- Uploads path configurável via `UPLOADS_PATH` (default: `./uploads`)

## Claude Code Harness

Configuração local do agente vive em `.claude/` + `.mcp.json`.

### Hooks (`.claude/hooks/`)

| Hook | Evento | Função |
|---|---|---|
| `session-start-health.sh` | `SessionStart` | Checa git status, dev server :3000, idade do backup (warn >24h), env vars Ollama |
| `session-end-cleanup.sh` | `SessionEnd` | Mata `next dev` órfão e processos na porta 3000 |
| `pre-schema-edit.sh` | `PreToolUse` (Edit/Write) | Lembra `npm run db:backup` antes + `db:generate`/`db:migrate` depois ao tocar `src/lib/db/schema.ts` |
| `post-edit-typecheck.sh` | `PostToolUse` (Edit/Write) | Roda `tsc --noEmit --incremental`, reporta apenas erros do arquivo editado (instrução: não chase cascade) |
| `post-api-route-check.sh` | `PostToolUse` (Edit/Write) | Sanity check em `src/app/api/**/route.ts`: HTTP export presente, SSE precisa `runtime=nodejs` + `dynamic=force-dynamic`, params async |

### MCP Servers (`.mcp.json`, project scope)

- **`playwright`** — browser automation p/ debug de scrapers (Greenhouse/Gupy/InHire) + verificar UI em browser real. Acessibility tree (sem screenshots) → barato em tokens
- **`context7`** — docs lookup up-to-date (Next.js 16, Drizzle, TanStack Query, shadcn). Usar `resolve-library-id` antes de `get-library-docs`

MCP global em user scope:
- **`shadcn`** — registry manager p/ adicionar componentes

### Skills (auto-trigger via descrição)

Project (`.claude/skills/`):
- `next-best-practices`, `react-best-practices`, `vercel-react-best-practices`
- `tanstack-query-best-practices`, `shadcn`, `playwright-cli`

User scope (globais):
- `webapp-testing` — Playwright frontend testing
- `frontend-design` — UI/dashboards/landing pages
- `vercel-composition-patterns` — refactor de componentes
- `prompt-engineering-patterns` — otimização de prompts Ollama/OpenAI
- `spec-driven-development`, `find-skills`

### Permissions allowlist

`.claude/settings.json` libera (sem prompt) read-only db ops, lint/typecheck, drizzle-kit, git read, lsof :3000.

### Dev flow

- Agente **pode** iniciar `npm run dev` se precisar verificar algo — `SessionEnd` faz cleanup
- Schema edit: hook lembra backup; depois rodar `npm run db:generate && npm run db:migrate` manual
- Após cada Edit em `.ts`/`.tsx`: typecheck incremental injeta erros do arquivo editado
