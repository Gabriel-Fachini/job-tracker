# Harness de agentes (Claude Code, Codex)

O projeto é desenvolvido em boa parte com agentes. A configuração local vive em `.claude/`, `.mcp.json`, `.codex/` e `.agents/`. As regras de comportamento para o agente ficam no [`CLAUDE.md`](../CLAUDE.md) (Claude Code) e no `AGENTS.md` (Codex e outros; no git o arquivo está como [`agents.md`](../agents.md), em minúsculas).

> `AGENTS.md` nasceu como cópia do `CLAUDE.md` e está defasado em relação a ele. Ao mudar regras, atualize os dois ou aponte um para o outro.

## Claude Code

### Hooks (`.claude/hooks/`, registrados em `.claude/settings.json`)

| Hook | Evento | Função |
|---|---|---|
| `session-start-health.sh` | `SessionStart` | reporta nº de mudanças não commitadas, se há servidor em `:3000`, idade do último backup em `backups/daily/` (aviso > 24 h) e se faltam `OLLAMA_*` no `.env.local` |
| `session-end-cleanup.sh` | `SessionEnd` | `pkill -f "next dev"` (qualquer projeto na máquina) e mata o que estiver em `:3000` |
| `pre-schema-edit.sh` | `PreToolUse` (Edit/Write/MultiEdit) | ao tocar `src/lib/db/schema.ts`: lembra de `npm run db:backup` antes e de gerar/aplicar migration depois |
| `post-edit-typecheck.sh` | `PostToolUse` (Edit/Write/MultiEdit) | `tsc --noEmit --incremental` (timeout 30 s); injeta **só** erros do arquivo editado. Usa o comando `timeout`, que o macOS não tem sem coreutils: no Mac o `tsc` nunca roda e o hook fica mudo |
| `post-api-route-check.sh` | `PostToolUse` (Edit/Write/MultiEdit) | em `src/app/api/**/route.ts`: export de método HTTP, `runtime`/`dynamic` para rotas com stream, `params` síncrono |

Observações:

- Os comandos usam caminho absoluto do checkout no Mac; em outra máquina/caminho precisam ser ajustados.
- O `SessionEnd` mata o processo em `:3000` mesmo quando é o servidor do usuário.
- A rota SSE atual (`monitoring/stream`) não declara `runtime`/`dynamic`; o hook avisaria se ela fosse editada.

### Permissões (`.claude/settings.json`)

Liberados sem prompt: `npm run db:backup|db:generate|db:migrate|db:restore`, `npm run lint`, `npm run typecheck`, `npx tsc --noEmit [--incremental]`, `node --test`, `npx drizzle-kit introspect|check`, `sqlite3 *.db .schema|.tables`, `ls backups/*`, `cat .specs/*`, `lsof -ti:3000`, `git status|diff|log|show`.

### Preview (`.claude/launch.json`)

Configuração `dev` (`npm run dev`, porta 3000, `autoPort`). Arquivo versionado: entradas temporárias (ex.: preview com banco sintético em outra porta) devem ser revertidas ao final. Receita em [desenvolvimento-local.md](desenvolvimento-local.md#banco-sintético-para-preview).

### MCP

Projeto (`.mcp.json`):

- **`playwright`** (`@playwright/mcp`): automação de browser para depurar scrapers (Greenhouse/Gupy/InHire) e verificar UI; usa árvore de acessibilidade (barato em tokens).
- **`context7`** (`@upstash/context7-mcp`): documentação atualizada de bibliotecas (Next.js 16, Drizzle, TanStack Query, shadcn). Rodar `resolve-library-id` antes de consultar.

Escopo do usuário: **`shadcn`** (registry de componentes).

### Skills

Projeto (`.claude/skills/`, várias são symlinks para `.agents/skills/`):

| Skill | Quando |
|---|---|
| `next-best-practices`, `vercel-react-best-practices`, `react-best-practices` | código Next/React |
| `tanstack-query-best-practices` | leads / Query |
| `shadcn` | componentes UI |
| `playwright-cli` | automação de browser |
| `impeccable` | design, crítica e polimento de UI (gitignored) |
| `glassdoor-collect` | coleta Glassdoor pelo Chrome logado → JSON v1 → `POST /api/glassdoor/import` (versionada) |
| `higgsfield-*` | geração de imagem/vídeo/marca (untracked em 2026-09-27) |

Globais úteis: `webapp-testing`, `frontend-design`, `vercel-composition-patterns`, `prompt-engineering-patterns` (prompts do classificador), `spec-driven-development`, `find-skills`.

`skills-lock.json` registra as skills instaladas.

## Codex

`.codex/` (não versionado): `config.toml` com os mesmos MCP (`context7`, `playwright`) e `hooks.json` apontando para cópias dos hooks em `.codex/hooks/` (schema, typecheck, route check, health; o cleanup existe como arquivo mas não está registrado).

## Regras para agentes (resumo)

1. Não subir `npm run dev` se `:3000` já responde; se subir outro servidor, encerrar ao final.
2. `npm run db:backup` antes de qualquer mudança de schema/migration.
3. Nunca commitar ou colar: `.env*`, banco, uploads, backups, `tmp/logs`, nome do tailnet, URL de produção (repo público).
4. Não copiar o banco real nem criar symlink do `.env.local` para worktrees; usar banco sintético.
5. Ampliar `allowedDevOrigins` ou afrouxar controles de segurança é decisão do usuário.
6. Só tokens do design system na UI (ver [ui-e-design-system.md](ui-e-design-system.md)).
7. Corrigir só os erros de tipo do arquivo editado.
8. Outra sessão pode estar editando o mesmo checkout: releia o arquivo antes de editar e não sobrescreva mudanças que não são suas.

## Worktrees

Agentes do Claude Desktop criam worktrees em `.claude/worktrees/<nome>` (ex.: a adaptação mobile, PR `Gabriel-Fachini/job-tracker#3`). Cada uma é um checkout completo com `.next` próprio; o ESLint da raiz as ignora. Detalhes de preview em [desenvolvimento-local.md](desenvolvimento-local.md#em-worktree-de-agente-claudeworktrees).
