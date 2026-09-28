# Testes e qualidade

## Testes unitários

Runner nativo do Node (`node:test`) com `tsx` para TypeScript e aliases `@/`. Sem Jest/Vitest. Arquivos `*.test.ts` ao lado do código; `npm test` roda o glob `src/**/*.test.ts` (subpastas incluídas).

| Arquivo | Cobre |
|---|---|
| `src/lib/job-monitoring/discovery.test.ts` | links relativos + dedup, página única, LinkedIn/navegação, landing page cross-origin, paginação em browser simulado, fingerprint |
| `src/lib/job-monitoring/extraction.test.ts` | JSON-LD `JobPosting`, fallback semântico, entidades HTML |
| `src/lib/job-monitoring/classification.test.ts` | sem perfil → `review`, payload inválido, JSON cercado |
| `src/lib/job-monitoring/signals.test.ts` | normalização pt-BR, sinais brasileiros |
| `src/lib/job-monitoring/index.test.ts` | orquestração com dependências injetadas; contadores do `MonitoringSummary` |
| `src/lib/job-monitoring/index-prefetched.test.ts` | `salaryText`/`workModel` do provider chegam ao lead gravado |
| `src/lib/job-monitoring/providers/providers.test.ts` | detecção Ashby/Lever, mapeamento de vagas (salário, local, modelo, `applyUrl`), erros HTTP, despacho com `fetchImpl` injetado |
| `src/lib/job-monitoring/bulk-run.test.ts` | varredura em lote |
| `src/lib/job-monitoring/progress-state.test.ts` | estado de progresso do radar |
| `src/lib/job-monitoring/run-state.test.ts` | run-state em memória |
| `src/lib/ai/ollama.test.ts` | datas opcionais, config cloud, header `Authorization`, unload em cloud |
| `src/lib/ai/resume-generation.test.ts` | seleção de projetos (máx. 2) |
| `src/lib/latex/escape.test.ts` | escape de cada caractere especial |
| `src/lib/latex/profile-adapter.test.ts` | projetos selecionados, match flexível |
| `src/lib/latex/render.test.ts` | seção de projetos condicional |

### Como rodar

```bash
npm test                       # suíte inteira, banco sintético
npm run test:job-monitoring    # só o radar (usa o DATABASE_URL do ambiente!)
npm run test:escape            # só o escape LaTeX
```

`npm test` é o caminho seguro:

- `pretest` roda `scripts/create-test-db.sh`, que recria `tmp/test.db` **só com o schema** (`sqlite3 .schema`, sem linhas) lido de `./job-tracker.db` (ou de `TEST_DB_SCHEMA_SOURCE`). Precisa do CLI `sqlite3`. A linha `sqlite_sequence` é removida (tabela interna, não pode ser criada à mão).
- `test` força `DATABASE_URL=./tmp/test.db` (vence o do shell e o `.env.local`) e zera `OLLAMA_*`/`OPENAI_API_KEY`.

Por que isolar: `index.test.ts` injeta extração/classificação/upsert, mas `getExistingJobLeadUrls` e `touchLastViewed` não são injetáveis e consultam o banco de `DATABASE_URL`. Por isso `test:job-monitoring` sem `DATABASE_URL` definido cai no `./job-tracker.db` real; prefira `npm test` ou prefixe `DATABASE_URL=./tmp/test.db` depois de `bash scripts/create-test-db.sh`.

### Estado em 2026-09-27

**61 de 61 passam** (`npm test`).

Semântica do `MonitoringSummary` fixada em `index.test.ts`:

- `skippedLinks`: URLs já em `job_leads`, puladas antes da extração.
- `jobsParsed`: só leads gravados **não descartados** (hoje sempre igual a `leadsSaved`); falha de extração/classificação não soma.
- `discarded`: gravados com `classification_status = discarded` (o upsert acontece antes da checagem, é a base do skip).
- `failed`: falha de extração ou classificação; nada é gravado.

Nenhum teste cobre UI, Server Actions, rotas, providers Greenhouse/Gupy/InHire ou logos. Ashby e Lever têm testes com fixtures.

## Tipos e lint

```bash
npm run typecheck         # tsc --noEmit
npm run lint              # eslint: next/core-web-vitals + next/typescript
```

- `tsconfig`: `strict`, `moduleResolution: bundler`, alias `@/* → src/*`, exclui `tmp/`.
- ESLint ignora `.next/`, `.claude/worktrees/**`, `out/`, `build/`.

## Checagens automáticas dos agentes

Hooks em `.claude/hooks/` (ver [harness-de-agentes.md](harness-de-agentes.md)):

- após cada edição em `.ts/.tsx`: `tsc --noEmit --incremental` (timeout 30 s), reportando **só** erros do arquivo editado — não persiga cascata em outros arquivos;
- após editar `src/app/api/**/route.ts`: confere export de método HTTP, `runtime`/`dynamic` em rotas com stream e `params` assíncrono.

## Verificação manual de UI

- Use o servidor do usuário em `:3000` ou um preview com banco sintético (nunca o banco real copiado).
- Leads exigem dados semeados: o banco local não tem triagem recente.
- Cheque os dois temas e o viewport mobile (presets `desktop`/`mobile` do browser pane).
- Ferramentas: MCP `playwright` (árvore de acessibilidade, barato), skill `webapp-testing`.

## Checklist antes de commitar

1. `npx tsc --noEmit` limpo nos arquivos tocados.
2. `npm run lint`.
3. Testes do módulo mexido.
4. Mudou schema? `npm run db:backup` antes, `npm run db:generate`, revise o SQL gerado, `npm run db:migrate` (ver [banco-de-dados.md](banco-de-dados.md#migrations)).
5. Nada de env, banco, uploads, nome do tailnet ou dado pessoal no diff (repo público).
