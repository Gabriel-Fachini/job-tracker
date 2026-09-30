---
name: glassdoor-collect
description: Coleta dados do Glassdoor (notas, benchmark do setor, avaliações, entrevistas, salários) de uma empresa ou de todas as empresas cadastradas, usando o Chrome logado do usuário, e importa no job-tracker. Decide sozinha entre primeira coleta (histórico completo) e atualização (só o que é novo) consultando o app, e cria a empresa se ela ainda não existir. Use quando o usuário pedir "coletar glassdoor", "atualizar glassdoor da <empresa>", "glassdoor full scan" ou colar um link glassdoor.com.br.
---

# Glassdoor collect

Coleta dados do Glassdoor pela sessão logada do usuário no Chrome, gera `tmp/glassdoor/glassdoor-<slug>-<data>.json` (schema v1) e importa no app.

**Input:** nome da empresa, URL do Glassdoor, ou `--all` (full scan). Opcional: `--full` força histórico completo mesmo com coleta anterior.

## Regras

- Usar **Claude in Chrome** (sessão real do usuário). Nunca fazer login, nunca resolver CAPTCHA/verificação: se aparecer, parar e pedir ao usuário que resolva na aba, depois continuar.
- Volume baixo: o extrator espaça requests (~1 s). Full scan é sequencial; nunca paralelizar. Frequência esperada: mensal.
- O JSON contém texto de avaliações: só em `tmp/` (gitignored). Nunca commitar, nunca publicar.
- URL do app e token vêm do ambiente do usuário, nunca do repo (repo é público):
  - `JOB_TRACKER_URL` — base do app (produção na tailnet; em dev, `http://localhost:3000`)
  - `GLASSDOOR_IMPORT_TOKEN` — mesmo valor de `/etc/job-tracker/env` na VPS
  Se faltar alguma, perguntar ao usuário. Não imprimir o token no chat.

## Passos

### 1. Aba do Glassdoor

`tabs_context_mcp` → abrir aba em `https://www.glassdoor.com.br/`. Confirmar login (header sem "Entrar"). Se não logado → pedir ao usuário.

### 2. Resolver `glassdoor_id`

- **URL:** regex `E(?:I_IE)?(\d+)` (ex.: `...-EI_IE<ID>.13,20.htm` ou `...-E<ID>.htm`).
- **Nome:** na aba,
  ```js
  await (await fetch('/searchsuggest/typeahead?numSuggestions=8&source=GD_V2&version=NEW&rf=full&fallback=token&input=' + encodeURIComponent(NOME), {credentials:'include'})).json()
  ```
  Filtrar `category === "company"`. Um `directHit` → usar. Vários candidatos → mostrar nome + id e perguntar.
- **`--all`:** os alvos vêm do passo 3 (empresas com `glassdoor_url`). Empresa cadastrada sem `glassdoor_url` → resolver pelo nome (typeahead) e listar para o usuário confirmar antes de coletar.

### 3. Primeira coleta ou atualização? (automático)

```bash
curl -fsS -H "Authorization: Bearer $GLASSDOOR_IMPORT_TOKEN" \
  "$JOB_TRACKER_URL/api/glassdoor/targets?glassdoorId=<ID>&name=<NOME>"   # sem params = todas
```

Resposta: `{ ok, targets: [...] }`; por alvo `{ companyId \| null, name, glassdoorId, glassdoorUrl, lastCollectedAt, latestReviewDate, latestInterviewDate }`.

| Situação | Ação |
|---|---|
| `companyId` null (empresa não cadastrada) | Primeira coleta completa. O import **cria a empresa**. Avisar o usuário que ela será criada. |
| Empresa existe, `lastCollectedAt` null | Primeira coleta completa (`since: null`). |
| Já coletada | Atualização: `since` = mais antiga entre `latestReviewDate` e `latestInterviewDate`, **menos 7 dias** (folga para avaliações publicadas com atraso; o import deduplica). |
| Última coleta há menos de 7 dias | Perguntar se quer mesmo recoletar. |
| `--full` | Sempre `since: null`. |

Notas e salários sempre vêm completos; `since` só corta avaliações e entrevistas.

Endpoint indisponível → perguntar ao usuário se segue com coleta completa, só gerando o arquivo (import depois pela tela).

### 4. Extrair

Ler `extractor.js` (mesma pasta) e executar via `javascript_tool` o conteúdo do arquivo seguido de:

```js
await collectGlassdoor({ employerIds: [ID, ...], download: true, since: "<ISO ou null>" })
```

`since` é único por execução: no full scan, agrupar as empresas pelo mesmo `since` (ou rodar uma por vez).

Retorno: `file`, `bytes`, contagens `coletado/total` e `warnings` por empresa, `errors`. O payload completo fica em `window.__jtGlassdoor`. `download: false` testa sem baixar.

- `errors` com HTTP 403/429 ou "sem payload RSC" → provável bloqueio/captcha: parar e avisar.
- `warnings` → reportar; o arquivo continua válido.

### 5. Mover e validar

```bash
mkdir -p tmp/glassdoor && mv ~/Downloads/glassdoor-*.json tmp/glassdoor/
jq '{v: .schema_version, since, errors, companies: [.companies[] | {n: .employer.name, r: .ratings.overall, rev: (.reviews.items|length), int: (.interviews.items|length), sal: (.salaries.items|length)}]}' tmp/glassdoor/<arquivo>
```

### 6. Importar

```bash
curl -fsS -X POST -H "Authorization: Bearer $GLASSDOOR_IMPORT_TOKEN" -H "content-type: application/json" \
  --data-binary @tmp/glassdoor/<arquivo> "$JOB_TRACKER_URL/api/glassdoor/import"
```

O import casa cada empresa por `glassdoor_id` (extraído de `companies.glassdoor_url` ou de snapshots anteriores) → nome normalizado → senão **cria** (`name`, `website`, `size`, `sector`, `glassdoor_url`). Numa empresa existente **nunca** troca o nome e só preenche `website`, `size`, `sector` e `glassdoor_url` quando vazios. Grava um snapshot (mesma coleta reimportada é ignorada) e insere avaliações/entrevistas novas sem duplicar.

Resposta: `{ ok, companies: [{ companyId, companyName, action: "created" | "updated", glassdoorId, snapshotId, newReviews, newInterviews, skippedDuplicateSnapshot }], errors }` (`errors` = falhas por empresa que o extrator reportou). HTTP 401 token errado, 503 token não configurado no servidor, 413 arquivo > 10 MB, 422 payload inválido.

Alternativa sem rede: upload do arquivo na tela da empresa.

### 7. Fechar

Fechar a aba criada pela skill. Resumir ao usuário: empresas criadas/atualizadas, variação da nota geral e itens novos.

## Schema v1 (resumo)

```
{ schema_version: 1, source: "glassdoor", collected_at, since, errors: [{glassdoor_id, error}],
  companies: [{
    employer: { glassdoor_id, name, overview_url, logo_url, website, headquarters, size, revenue,
                ownership, year_founded, industry, sector },
    ratings: { overall, culture_values, work_life_balance, compensation_benefits, career_opportunities,
               senior_management, diversity_inclusion,            // 1–5
               recommend_to_friend, ceo_approval, business_outlook, // 0–1
               review_count, ceo: {name, title},
               industry_benchmark: {mesmas chaves}, distribution: {overall: {_1.._5}, ...} },
    reviews: { total, all_languages_total, items: [{ id, date, job_title, location, employment_status,
               is_current, years_employed, rating, sub_ratings: {...}, recommend, ceo, business_outlook,
               summary, pros, cons, advice, helpful, has_employer_response }] },
    interviews: { total, difficulty_avg, experience_counts, channel_counts,
                  items: [{ id, date, job_title, location, difficulty, experience, outcome,
                            duration_days, process, questions: [] }] },
    salaries: { job_title_count, pay_period: "MONTHLY", location,
                items: [{ job_title, currency, count, most_recent,
                          base: {p10,p25,p50,p75,p90,...}, total: {...} }] },
    warnings: [] }] }
```

O extrator coleta tudo; o que é descartado ou guardado fica a cargo do import.

## Fontes (descobertas em 2026-09-28; se quebrar, revalidar)

Tudo via `fetch` same-origin a partir de qualquer página do glassdoor.com.br, com os cookies da sessão:

- Overview: `GET /Overview/W-EI_IE<id>.htm` (redireciona pro canônico) → payload RSC (`self.__next_f.push`) com `employer` (dois objetos parciais), `ratings`, `industryBenchmarkRatings`, `ratingCountDistribution`.
- `POST /bff/employer-profile-mono/employer-reviews` (`pageSize` até 50, `language: "por"`, `applyDefaultCriteria: true` = o que o site mostra).
- `POST /bff/employer-profile-mono/employer-interviews` (`itemsPerPage` 50).
- `POST /bff/employer-profile-mono/agg-salary-estimates` (`pageSize` 100, `payPeriod: "MONTHLY"`, `jobTitle` filtra por texto).
- Nome → id: `GET /searchsuggest/typeahead`.

Se um BFF mudar: abrir a página correspondente e procurar a chave SWR `#url:"/bff/..."` no RSC para ver os args atuais.
