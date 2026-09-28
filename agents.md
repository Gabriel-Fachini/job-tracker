# Job Tracker - Project Context

> Cópia do `CLAUDE.md` para agentes que leem `AGENTS.md` (Codex e outros). O `CLAUDE.md` é a fonte: edite lá e copie para cá. A config local do Codex fica em `.codex/` (MCP `context7`/`playwright` e as mesmas hooks, sem a de `SessionEnd`).

App pessoal (single-user, **sem autenticação**) para busca de emprego: perfil → empresas → radar de vagas (scraping + IA) → triagem de leads → candidaturas → dashboard. UI em pt-BR.

**Documentação detalhada em `docs/`** (índice: `docs/README.md`). Antes de mexer num módulo, leia a página dele; ao mudar comportamento documentado, atualize a página no mesmo commit. Problemas já mapeados: `docs/problemas-conhecidos.md`.

## Regras invioláveis

- Repo GitHub `Gabriel-Fachini/job-tracker` é **público**: nunca commitar `.env*`, banco, `uploads/`, `backups/`, `tmp/` (inclui `tmp/logs` com dados de currículo), nome do tailnet, URL de produção ou dados pessoais. Em docs, usar placeholders (`<TAILNET>`, `<DOMINIO_PESSOAL>`).
- `npm run db:backup` antes de qualquer migration ou alteração no schema.
- Nunca copiar o banco real nem linkar `.env.local` para worktrees/previews; usar banco sintético (`docs/desenvolvimento-local.md`).
- Afrouxar controles de segurança (ex.: ampliar `allowedDevOrigins`, `tailscale funnel`) é decisão do usuário.
- Outra sessão pode estar editando o mesmo checkout (e até trocando de branch): releia o arquivo antes de editar e não sobrescreva mudanças que não são suas.

## Stack

- Next.js 16 (App Router, Server Actions, Turbopack) + React 19 + TypeScript
- SQLite (`better-sqlite3`, síncrono) + Drizzle ORM (`src/lib/db/schema.ts`)
- TanStack Query na página de leads (o diálogo de excluir empresa só invalida `["leads"]`); demais telas: Server Component + `router.refresh()`
- SSE (`EventSource`) para progresso real-time do radar
- Ollama (modo `cloud`): classificação de leads, seleção do currículo, botão "Formatar" da candidatura
- OpenAI: extração do perfil a partir do PDF (obrigatória nesse fluxo) + formatação opcional de descrições no radar
- Playwright/Chromium (radar em modo `browser`), `tectonic` (currículo LaTeX → PDF)

## UI / Design System

- Spec normativa: `DESIGN.md` (tokens, receitas de componentes, do's/don'ts). Contexto de produto: `PRODUCT.md`. Mapa do código: `docs/ui-e-design-system.md`.
- Linguagem adaptada da Notion: neutros quentes, roxo só no botão principal (um por tela) e no foco, status como tags pastel (`Tag`). Dois temas: escuro (padrão, conteúdo em `#000` dentro de moldura grafite quente) e claro (branco + texto charcoal `#37352f`). Só tokens de `src/app/globals.css`; nunca cores da paleta Tailwind (`emerald-400`...), hex, oklch literal ou `bg-black`/`text-white`/`shadow-black` em componentes.
- Tema: `src/lib/theme.ts` (script anti-flash no `<head>`) + `src/hooks/use-theme.ts`. Seletor na sidebar e em Perfil → Aparência.
- Fonte Inter (UI) + Geist Mono (`font-data`) para números/datas/scores. Primitives próprios em `src/components/ui/`: `tag`, `status`, `panel`, `notice`, `meta-line`, `tab-bar`, `segmented-control`, `native-select`, `chip`.
- Logo: `public/brand/jt-monogram.png` (fonte) e `jt-mark.png` (máscara da sidebar); ícones em `src/app/icon.png`, `apple-icon.png`, `favicon.ico`.

## AI Runtime

`OLLAMA_RUNTIME_MODE=cloud` — classificação roda via HTTP remoto, não local. Detalhes: `docs/ia.md`.

**Env vars** (`.env.local` em dev, `/etc/job-tracker/env` na VPS; modelo em `.env.example`):

| Var | Descrição |
|-----|-----------|
| `OLLAMA_RUNTIME_MODE` | `cloud` ou `local` (obrigatória, sem default) |
| `OLLAMA_BASE_URL` | URL base da API Ollama |
| `OLLAMA_MODEL` | Nome do modelo (ex: `gemma3:4b`) |
| `OLLAMA_API_KEY` | API key (obrigatória em `cloud`, enviada como Bearer) |
| `OLLAMA_TIMEOUT_MS` | Timeout por request (default: `240000`) |
| `OPENAI_API_KEY` | extração de perfil; formatação opcional |
| `OPENAI_COMPARISON_MODEL` | modelo da extração de perfil (default `gpt-5.4`; não deixar definida e vazia) |
| `OPENAI_FORMAT_JOB_DESCRIPTIONS` | `true` formata descrições do radar com `gpt-4o-mini` (default `false`) |
| `DATABASE_URL` / `UPLOADS_PATH` | default `./job-tracker.db` / `./uploads`; em produção `DATABASE_URL` absoluto e existente (fail closed) |

Ambos `extractJobDetail` (HTTP fetch ao job board) e `classifyJobLead` (HTTP ao Ollama cloud) são I/O bound: links de uma empresa rodam em paralelo com `pLimit(5)` (`LINK_PROCESSING_CONCURRENCY` em `src/lib/job-monitoring/index.ts`); empresas rodam em sequência. Ganho medido: ~2s/link → ~100s sequencial para 50 links → ~20s paralelo.

## Radar de Vagas (Monitoramento)

Pipeline completo: `docs/radar-manual-de-vagas-implementacao.md`.

Três gatilhos:
- `/leads` "Rodar radar" → `new EventSource("/api/monitoring/stream")` (**GET**; cada GET inicia um run). Único caminho com SSE, `run-state` e relatório final no terminal.
- `/companies` → Server Action `runAllCompaniesMonitoring()` (sem SSE, sem run-state).
- `/companies/[id]` → `runCompanyMonitoring(id)` (uma empresa, ignora status).

Varredura em lote cobre empresas com `jobs_board_url` válido e status fora de `radarSkippedCompanyStatuses` (`discarded`, `blacklist`).

Por empresa (`runMonitoringForCompany`):
1. Descoberta: provider ATS (`auto` detecta Greenhouse/Gupy/InHire/Ashby/Lever pela URL) com detalhes pré-carregados; fallback scraping `fetch` ou `browser` (Playwright). LinkedIn é ignorado.
2. URLs já em `job_leads` (qualquer status) são **puladas** (`link-skipped`, só atualiza `last_viewed`): leads nunca são reclassificados.
3. Cada link novo, dentro do mesmo callback do `pLimit`: extração → hints do texto do link → formatação OpenAI opcional → classificação → upsert. Sem Phase 2 separada.
4. Todas as decisões são gravadas, **inclusive `discarded`** (base do skip); as telas filtram descartados. Falha de extração/classificação conta como `failed` e **não grava** (URL é tentada de novo no próximo run). Sem perfil salvo → `review`/40 sem chamar o LLM.

**SSE events:** `start`, `company-start`, `link-processing`, `link-skipped`, `link-done` (com `lead` quando não descartado), `company-done`, `all-done`, `error` (falha de uma empresa; o run continua).

Ciclo de vida (`src/lib/job-monitoring/bulk-run.ts` + `run-state.ts`, em memória, um processo): um run SSE por vez (o segundo recebe `error` com `fatal: true`, `reason: "already-running"`); erro de empresa (`company`, `fatal: false`) não encerra o run; fechar o `EventSource` (Cancelar, fechar/recarregar a aba) cancela o run no servidor; sem evento há 15 min o run vira `stale`; o estado é sempre limpo em `finally`. Aba sem stream próprio acompanha `/api/monitoring/current` a cada 3 s. Runs de `/companies` não passam pelo tracker.

**Arquivos-chave:**
- `src/app/api/monitoring/stream/route.ts` — Route Handler SSE (GET)
- `src/app/api/monitoring/current/route.ts` — GET snapshot do run atual (usado pelo `deploy.sh`)
- `src/server/actions/job-monitoring.ts` — seleção de empresas, execução, aprovar/descartar/promover
- `src/lib/job-monitoring/index.ts` — pipeline por empresa
- `src/lib/job-monitoring/{discovery,extraction,signals,classification,persistence}.ts`, `providers/`
- `src/lib/job-monitoring/run-state.ts` — estado in-memory do run

## Página de Leads (TanStack Query)

**Fluxo de dados:**

1. `leads/page.tsx` (Server Component) faz query Drizzle direta → passa `items` como `initialData` para `LeadsClient`
2. `LeadsClient` usa `useQuery({ queryKey: ["leads"], queryFn: getLeads, initialData: items, staleTime: 30_000 })`
3. `getLeads()` é Server Action em `src/server/actions/leads.ts` — sem route handler `/api/leads`
4. `MonitoringProgressContext` escuta SSE e chama `queryClient.invalidateQueries({ queryKey: ["leads"] })` a cada `link-done` com `decision !== "discarded"`
5. Aprovar/descartar são otimistas (`src/components/leads/lead-decisions.ts`); `discardLead` também sobrescreve `classification_status` para `discarded` e não há desfazer

**Decisões arquiteturais:**
- `initialData` (não `placeholderData`) → zero loading flicker no primeiro render
- `staleTime: 30_000` → sem refetch desnecessário durante scan
- Invalidação apenas para `interesting`/`review` → descartados não aparecem no board
- `QueryProvider` deve envolver `MonitoringProgressProvider` no layout (hierarquia de providers)
- Estado de UI na URL (`tab`, `status`, `companyId`, `q`, `leadId`) via `useSearchParamsUpdater` (History API)

**Arquivos-chave:**
- `src/app/(app)/leads/page.tsx` — Server Component com query inicial
- `src/components/leads/leads-client.tsx` — useQuery + UI
- `src/components/leads/monitoring-progress-context.tsx` — SSE listener + invalidação
- `src/providers/query-provider.tsx` — QueryClientProvider
- `src/server/actions/leads.ts` — Server Actions de leads

## Empresas (lista CRUD + logos)

- Lista (`src/app/(app)/companies/page.tsx`): linha inteira abre o detalhe; `CompanyRowActions` põe Editar/Excluir (ícones a partir de `sm`, botão ⋯ com bottom sheet no celular). O sheet de edição abre com os dados da linha (sem fetch) e salva sem sair da lista.
- Server actions (`src/server/actions/companies.ts`): `updateCompany`/`deleteCompany` retornam `CompanyMutationResult` (sem redirect; `deleteCompany(id, { redirectToList: true })` no detalhe). Excluir é bloqueado se há `jobs` vinculados; os `job_leads` da empresa são apagados junto (FK ligada no better-sqlite3).
- Status: o valor escolhido no form é salvo como está. Só `syncCompanyStatusForApplication` (candidatura criada ou status alterado) recalcula; `updateCompany` não chama `syncCompanyStatus`.
- Logos (`src/lib/company-logos.ts` + `GET /api/companies/[id]/logo`): buscados no próprio site da empresa (apple-touch-icon > ícones `<link>` > `/favicon.ico`) na 1ª vez que a linha pede, cacheados em `<UPLOADS_PATH>/logos` (`companies.logo_path`). `logo_url` é override manual. Sem ícone: nova tentativa em 3 dias; falha transitória: 30 min. Fetch bloqueia IPs privados/loopback/tailnet e segue redirects manualmente.

## Candidaturas, Perfil, Currículo

- Candidaturas (`/applications`): abas por status (não é kanban), troca de status otimista + `application_status_history` + status da empresa derivado. Docs: `docs/modulos/candidaturas.md`.
- Perfil: PDF → `POST /api/profile/upload` (pdfjs) → `extractProfileDraft` (**OpenAI**) → `saveExtractedProfile`. Cada gravação apaga e reinsere as linhas filhas. Docs: `docs/modulos/perfil.md`.
- Currículo: `generateResume` (Ollama seleciona bullets/skills → Mustache + LaTeX → `tectonic`), grava caminho absoluto em `applications.generated_resume_path`. Docs: `docs/modulos/curriculo.md`.

## Job Description Formatting

- Radar: `OPENAI_FORMAT_JOB_DESCRIPTIONS=true|false` (default `false`); descriptions sem estrutura markdown são reformatadas via `gpt-4o-mini` antes da classificação. Non-blocking: erro loga e mantém a description original.
- Candidatura: botão "Formatar" usa Ollama (`formatJobDescriptionWithOllama`), não OpenAI.

## Database

**Antes de qualquer migration ou alteração no schema:**

```bash
npm run db:backup
```

- Backups diários às 03:00: LaunchAgent no Mac (`com.gabrielfachini.jobtracker-backup`) e `job-tracker-backup.timer` na VPS; rotação por idade (7 dias diários, 28 semanais, 93 mensais). O deploy também faz snapshot `pre-deploy` antes de migrar.
- Restore: `npm run db:restore backups/daily/job-tracker-YYYY-MM-DD.db.gz` (pede `yes`; pare o app antes)
- Migrations: `npm run db:generate` → revisar o SQL → `npm run db:migrate`. A cadeia de snapshots foi religada em `8db7fd9`; `npx drizzle-kit check` passa.
- `drizzle-kit migrate` aplica journal entries com `when` > último `created_at` de `__drizzle_migrations`, tudo numa transação; pode falhar com **exit 1 e nenhuma mensagem** (ex.: `duplicate column`). Diagnóstico: comparar `sqlite3 <db> .schema` com o SQL pendente.
- Banco **vazio não migra** (`0007` termina em statement vazio; as duas `0013` quebram). Criar banco novo a partir de `.schema` de um existente.
- Desde 2026-09-25 a VPS é a fonte da verdade; o banco do Mac é só dev (sem leads recentes em triagem).
- Schema, enums e histórico: `docs/banco-de-dados.md`.

## Deploy / Produção

- VPS Oracle A1 (Ubuntu 24.04) acessível só via Tailscale: `tailscale serve` → Next em `127.0.0.1:3000`, zero porta pública, **nunca** `funnel`. SSH: `ssh job-tracker`.
- Deploy pull-based: `job-tracker-deploy.timer` (5 min) → `deploy/deploy.sh` (release nova, build, espera run SSE, backup, migrate, troca de symlink, health check `/dashboard`, rollback automático). **Sem GitHub Actions** (nenhuma credencial no GitHub). Push na `main` = deploy.
- Env de produção em `/etc/job-tracker/env` (lido por systemd e por bash: `CHAVE=valor`, sem espaços, sem `<>`).
- Runbook: `deploy/README.md`. Contexto e cuidados: `docs/deploy-e-operacao.md`.

## Dev Server

- App roda **sempre** na porta 3000 (usuário mantém processo ativo)
- **Nunca** executar `npm run dev` para testar — server já está rodando
- Se iniciar servidor de dev durante conversa para verificar algo, **encerrá-lo ao terminar** e reverter entradas temporárias do `launch.json` (arquivo versionado)
- Preview isolado no checkout principal: segundo `next dev` não sobe (`.next/dev/lock`); usar `npm run build` com `DATABASE_URL`/`UPLOADS_PATH` sintéticos + `next start -p 3100` via `launch.json`, depois apagar `.next/*` exceto `dev/`. Receita: `docs/desenvolvimento-local.md`
- Se server não responder, pedir ao usuário iniciar antes de prosseguir
- `DATABASE_URL` no ambiente do processo vence o `.env.local` → preview com banco sintético sem editar env
- Mudança em `globals.css` não aparece? Cache do Turbopack: parar, `rm -rf .next`, subir; conferir com `getComputedStyle` antes de depurar o componente
- Browser pane: usar presets `desktop`/`mobile` em `resize_window` (tamanho maior que o painel gera screenshot preto)

## Architecture Notes

- Radar ainda é disparado manualmente. Planejado (2026-09-25): scans 09h/14h/19h `America/Sao_Paulo` via timer systemd → endpoint interno com token, e digest diário por e-mail (Resend). Hoje os únicos timers são de deploy e backup na VPS.
- Candidaturas nunca são enviadas automaticamente (fila de aprovação humana).
- Acesso ao banco é síncrono no event loop de um único processo; o código não configura WAL (DB local em `journal_mode=delete`). `pLimit(5)` paraleliza I/O de rede, não escritas; `SQLITE_BUSY` só com outro processo (CLI, drizzle-kit, backup).
- Estado em memória assume um processo: `run-state` do radar, buscas de logo em andamento, conexão do banco.
- SSE suficiente para real-time UX sem separação de processos
- Uploads path configurável via `UPLOADS_PATH` (default: `./uploads`); caminhos de uploads gravados relativos ao `cwd`, currículo gerado absoluto.
- Sem autenticação: proteção é de rede (Tailscale). `/api/monitoring/stream` responde `Access-Control-Allow-Origin: *`.

## Testes

- Suíte inteira: `npm test` (`pretest` recria `tmp/test.db` só com o schema do `./job-tracker.db`; o script força `DATABASE_URL=./tmp/test.db` e zera as chaves de IA). `npm run test:job-monitoring` e `npm run test:escape` usam o `DATABASE_URL` do ambiente — sem ele, o radar consulta o banco real. Detalhes em `docs/testes-e-qualidade.md`.
- Estado em 2026-09-27: 61/61 passam.
- Typecheck: `npm run typecheck` (`tsc --noEmit`). Lint: `npm run lint`.

## Claude Code Harness

Configuração local do agente vive em `.claude/` + `.mcp.json` (Codex: `.codex/`, não versionado). Detalhes: `docs/harness-de-agentes.md`.

### Hooks (`.claude/hooks/`)

| Hook | Evento | Função |
|---|---|---|
| `session-start-health.sh` | `SessionStart` | Checa git status, dev server :3000, idade do backup (warn >24h), env vars Ollama |
| `session-end-cleanup.sh` | `SessionEnd` | `pkill -f "next dev"` (qualquer projeto na máquina) e mata o que estiver na porta 3000, inclusive o servidor do usuário |
| `pre-schema-edit.sh` | `PreToolUse` (Edit/Write) | Lembra `npm run db:backup` antes + `db:generate`/`db:migrate` depois ao tocar `src/lib/db/schema.ts` |
| `post-edit-typecheck.sh` | `PostToolUse` (Edit/Write) | Roda `tsc --noEmit --incremental`, reporta apenas erros do arquivo editado (instrução: não chase cascade). **No macOS sem coreutils não roda** (usa `timeout`): rode `npx tsc --noEmit` à mão |
| `post-api-route-check.sh` | `PostToolUse` (Edit/Write) | Sanity check em `src/app/api/**/route.ts`: HTTP export presente, SSE precisa `runtime=nodejs` + `dynamic=force-dynamic`, params async |

### MCP Servers (`.mcp.json`, project scope)

- **`playwright`** — browser automation p/ debug de scrapers (Greenhouse/Gupy/InHire) + verificar UI em browser real. Acessibility tree (sem screenshots) → barato em tokens
- **`context7`** — docs lookup up-to-date (Next.js 16, Drizzle, TanStack Query, shadcn). Usar `resolve-library-id` antes de `get-library-docs`

MCP global em user scope:
- **`shadcn`** — registry manager p/ adicionar componentes

### Skills (auto-trigger via descrição)

Project (`.claude/skills/`):
- `next-best-practices`, `react-best-practices`, `vercel-react-best-practices`
- `tanstack-query-best-practices`, `shadcn`, `playwright-cli`, `impeccable`

User scope (globais):
- `webapp-testing` — Playwright frontend testing
- `frontend-design` — UI/dashboards/landing pages
- `vercel-composition-patterns` — refactor de componentes
- `prompt-engineering-patterns` — otimização de prompts Ollama/OpenAI
- `spec-driven-development`, `find-skills`

### Permissions allowlist

`.claude/settings.json` libera (sem prompt) leitura do banco, lint/typecheck, drizzle-kit, git read, lsof :3000 — e também `db:migrate`, `db:generate` e `db:restore`, que alteram o banco.

### Dev flow

- Servidor do usuário em :3000 é o padrão; servidor extra só quando preciso (outra porta, banco sintético) e encerrado ao final — `SessionEnd` faz cleanup (e também mata o que estiver em :3000)
- Worktree de agente (`.claude/worktrees/*`): rodar com `DATABASE_URL` não definido, usando o `./job-tracker.db` da worktree com seed fictício
- Schema edit: hook lembra backup; depois `npm run db:generate && npm run db:migrate`
- Após cada Edit em `.ts`/`.tsx`: typecheck incremental injeta erros do arquivo editado
