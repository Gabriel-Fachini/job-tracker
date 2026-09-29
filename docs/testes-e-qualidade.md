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
| `src/lib/job-monitoring/sources/sources.test.ts` | fetchers Himalayas (cursor/paginação), Remote OK, We Work Remotely (RSS), Jobicy e HN (thread + cabeçalho `Empresa \| Cargo \| Local`) com `fetchImpl` falso |
| `src/lib/job-monitoring/source-run.test.ts` | pipeline de fonte: URL conhecida, dedup no banco e no feed, sink de descartados, empresa só para lead útil, cursor só em run completo |
| `src/lib/job-monitoring/bulk-run-sources.test.ts` | fontes como etapas do run (`total`, `index`, erro por fonte, cancelamento) |
| `src/lib/job-monitoring/index-dedup.test.ts` | ATS "adota" o lead que um agregador já trouxe |
| `src/lib/job-monitoring/persistence.test.ts` | campos de fonte no upsert, janela de 60 dias, `adoptAtsLink`, resolvedor de empresas, semeadura de `job_sources` (banco de teste) |
| `src/lib/companies/normalize.test.ts` | nome/domínio/título normalizados, `dedup_key`, `CompanyIndex` |
| `src/lib/companies/ats-discovery.test.ts` | extração de links Ashby/Lever/Greenhouse, slugs, descoberta por link e por slug |
| `src/lib/companies/yc-import.test.ts` | filtro YC, upsert idempotente, `--dry-run` sem gravar |
| `src/lib/job-monitoring/bulk-run.test.ts` | varredura em lote |
| `src/lib/job-monitoring/progress-state.test.ts` | estado de progresso do radar |
| `src/lib/job-monitoring/run-state.test.ts` | run-state em memória |
| `src/lib/search-preferences.test.ts` | normalização das preferências, piso anual (mensal × 12 vs anual), tolerância a JSON quebrado, linha única no banco de teste |
| `src/lib/ai/typesafe.test.ts` | cliente Jev: config fail-closed, versão fixa, corpo, retry 429/529, erros |
| `src/lib/ai/generation.test.ts` | `GENERATION_ENGINE`, modelos default, `formatJobDescription`, chamada estruturada da OpenAI (cliente falso) |
| `src/lib/job-monitoring/triage/hard-filters.test.ts` | estágio 0: título, restrições, frases "US only", fuso, salário |
| `src/lib/job-monitoring/triage/salary.test.ts` | parse de salário, candidatos, normalização para US$/ano |
| `src/lib/job-monitoring/triage/triage.test.ts` | estados enxutos, sem dados pessoais, regras dos estágios 1 e 2, `triageJob` ponta a ponta, motores OpenAI/Jev/Ollama com clientes falsos |
| `src/lib/job-monitoring/triage/eval.test.ts` | fixtures do `triage:eval` (estágio 0 = 100%) e pontuação por pergunta |
| `src/lib/job-monitoring/triage-persistence.test.ts` | colunas da triagem, mapper, motivo manual no feedback, painel internacional |
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

### Estado (feat/radar-internacional)

Baseline em 2026-09-27: 61 de 61. Com as fases 1 a 4 da branch `feat/radar-internacional`: **tudo passa** (`npm test`, ver a contagem no final da saída). A suíte roda hermética: `npm test` zera `OLLAMA_*`, `OPENAI_*`, `TYPESAFE_API_KEY`, `TRIAGE_ENGINE` e `GENERATION_ENGINE`, e nenhum teste chama a rede.

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
