# Módulo: Glassdoor

Notas, benchmark do setor, avaliações, relatos de entrevista e faixas salariais de cada empresa, coletados do Glassdoor pela sessão logada do usuário e importados no app. Nada é raspado pelo servidor: a coleta roda no Chrome do usuário (skill) e o app só recebe o JSON.

## Arquivos

| Arquivo | Papel |
|---|---|
| `.claude/skills/glassdoor-collect/` | skill: `SKILL.md` (fluxo) e `extractor.js` (roda na aba do Glassdoor via Claude in Chrome) |
| `src/lib/glassdoor/payload.ts` | tipos e validação do schema v1 (`parseGlassdoorPayload`) |
| `src/lib/glassdoor/import.ts` | `importGlassdoorPayload`: casa/cria a empresa e grava tudo |
| `src/lib/glassdoor/match.ts`, `identity.ts` | casamento de empresa, `parseGlassdoorId`, normalização de nome, mapa de porte |
| `src/lib/glassdoor/targets.ts` | `getGlassdoorTargets`: o que a skill consulta antes de coletar |
| `src/lib/glassdoor/auth.ts` | token Bearer (`timingSafeEqual`), leitura de corpo com limite de 10 MB |
| `src/lib/glassdoor/delete.ts` | remove os dados Glassdoor de empresas (usado por `deleteCompany`) |
| `src/lib/glassdoor/queries.ts`, `view.ts` | `getGlassdoorView(companyId)` e derivados (tendência por ano, mediana) |
| `src/lib/glassdoor/constants.ts` | regex de cargos de tecnologia (`isTechTitle`) |
| `src/app/api/glassdoor/{import,targets}/route.ts` | endpoints da skill |
| `src/server/actions/glassdoor.ts` | `importGlassdoorFile`: upload manual pela UI |
| `src/components/glassdoor/` | seção da página da empresa e controle de upload |

## Fluxo

1. A skill pergunta ao app o que já existe: `GET /api/glassdoor/targets?glassdoorId=<id>&name=<nome>` (sem parâmetros: todas as empresas elegíveis). Com isso decide entre **primeira coleta** (histórico completo) e **atualização** (`since` = a mais antiga entre `latestReviewDate` e `latestInterviewDate`, menos 7 dias).
2. A skill executa `extractor.js` na aba do Glassdoor e grava `tmp/glassdoor/glassdoor-<slug>-<data>.json` (gitignored: contém texto de avaliações).
3. A skill envia o arquivo: `POST /api/glassdoor/import`. Alternativa sem rede: "Importar JSON do Glassdoor" na lista de empresas ou na página da empresa (Server Action, sem token: só alcançável pela UI).
4. O app valida o payload, casa a empresa, grava e responde por empresa.

## Endpoints

Ambos exigem `Authorization: Bearer <GLASSDOOR_IMPORT_TOKEN>`. Variável ausente ou vazia → **503** (fail closed); token errado ou ausente → **401**. `runtime = "nodejs"`, `force-dynamic`, `Cache-Control: no-store`.

| Rota | Entrada | Resposta |
|---|---|---|
| `GET /api/glassdoor/targets` | `glassdoorId` (inteiro > 0) e/ou `name`, opcionais. Id inválido → 400 | `{ ok: true, targets: [{ companyId \| null, name, glassdoorId \| null, glassdoorUrl, lastCollectedAt, latestReviewDate, latestInterviewDate }] }` |
| `POST /api/glassdoor/import` | corpo JSON schema v1 (≤ 10 MB → senão 413; JSON inválido → 400; payload inválido ou `schema_version` desconhecida → 422) | `{ ok: true, companies: [{ companyId, companyName, action: "created" \| "updated", glassdoorId, snapshotId, newReviews, newInterviews, skippedDuplicateSnapshot }], errors: [{ glassdoorId, error }] }` |

`targets` sem parâmetros lista as empresas fora de `radarSkippedCompanyStatuses` (`discarded`, `blacklist`), incluindo as sem `glassdoor_url` (`glassdoorId: null`: a skill resolve pelo nome). Com parâmetros e sem casamento: uma entrada com `companyId: null`. `errors` do payload (falhas por empresa relatadas pelo coletor) passam direto na resposta.

### Token

```bash
openssl rand -hex 32
```

- Dev: `GLASSDOOR_IMPORT_TOKEN=...` no `.env.local` (modelo em `.env.example`).
- VPS: linha `GLASSDOOR_IMPORT_TOKEN=<valor>` em `/etc/job-tracker/env` (formato `CHAVE=valor`, sem espaços) e reiniciar o serviço. O mesmo valor fica no ambiente do usuário que roda a skill. **Nunca** commitar; o app da VPS só é alcançável pela tailnet.
- A skill lê `JOB_TRACKER_URL` (base do app) e `GLASSDOOR_IMPORT_TOKEN` do ambiente do usuário.

## Casamento e identidade

Regra do usuário: o cadastro da empresa manda. Para cada empresa do payload, em uma transação por empresa:

1. **Por `glassdoor_id`**: o id extraído (`parseGlassdoorId`, regex `E(?:I_IE)?(\d+)`) de `companies.glassdoor_url`, ou o `glassdoor_id` de algum snapshot da empresa.
2. **Por nome normalizado** (minúsculas, sem acentos, espaços colapsados). Uma empresa que já tem outro `glassdoor_id` conhecido **não** casa por nome (mesmo nome, outro empregador).
3. Sem casamento: **cria** a empresa (`name`, `website`, `size`, `sector`, `glassdoor_url` = `overview_url`; o resto no default, status `monitoring`).

Em empresa existente:

- `companies.name` nunca muda.
- `website`, `size`, `sector` e `glassdoor_url` só são preenchidos quando vazios.
- O nome, o id e a URL do Glassdoor ficam no `data_json` do snapshot; `glassdoor_id` também é coluna indexada do snapshot, só para casamento.
- `size` do Glassdoor (ex.: "201 a 500 funcionários") vira o porte do app pelo limite superior: ≤ 200 `small`, ≤ 500 `medium`, ≤ 5.000 `large`, acima `enterprise`; ilegível → não preenche. `startup` nunca é atribuído automaticamente.

## Dados gravados

`glassdoor_snapshots` (uma linha por coleta; único em `company_id + collected_at`, então reimportar o mesmo arquivo não duplica; nesse caso `skippedDuplicateSnapshot: true` e as tabelas filhas seguem sendo conferidas):

| Grupo | Colunas |
|---|---|
| chave | `company_id`, `glassdoor_id` (índice), `collected_at`, `since` |
| notas (1 a 5) | `overall`, `culture_values`, `work_life_balance`, `compensation_benefits`, `career_opportunities`, `senior_management`, `diversity_inclusion` |
| percentuais (0 a 1) | `recommend_to_friend`, `business_outlook`, `ceo_approval` |
| contagens | `review_count`, `interview_difficulty`, `interview_positive/neutral/negative`, `interview_count` |
| `data_json` | `{ employer: { name, glassdoor_id, overview_url, year_founded }, industry_benchmark, distribution, interview_channel_counts }` |

`glassdoor_salaries` (por snapshot; **todos** os cargos, o filtro de tecnologia é da UI): `job_title`, `salary_count`, `base_p10/p25/p50/p75/p90`, `total_p10/…/p90`, `extra_json` (`{ most_recent }`).

`glassdoor_reviews` e `glassdoor_interviews` (por empresa, deduplicadas pelo id do Glassdoor com `ON CONFLICT DO NOTHING`, `first_seen_at`): campos de texto, `rating`/`difficulty`/`experience`/`outcome`, `years_employed`, `duration_days`, perguntas em `questions_json`; localização da avaliação em `extra_json`.

Descartado na importação: logo, setor detalhado (`industry`), sede, faturamento, natureza, nome do CEO, votos por avaliação (recomenda/perspectiva/CEO), subnotas por avaliação, tipo de vínculo, "útil"/resposta da empresa, local da entrevista, percentis p0,5/p5/p95/p99,5 e moeda.

## Exclusão

`deleteCompany` e `bulkDeleteCompanies` chamam `deleteGlassdoorDataForCompanies` na mesma transação: salários, snapshots, avaliações e entrevistas saem antes da empresa (FKs ligadas, sem cascade).

## UI

Seção "Glassdoor" na página da empresa (`/companies/[id]`), abaixo da ficha, como um painel com abas:

- **Notas**: nota geral grande, ▲/▼ contra a coleta anterior (a partir da 2ª coleta) e contra a média do setor; seis subnotas em barras com traço do setor; recomendam / perspectiva / aprovam o CEO com diferença em pp contra o setor; tendência (nota média por ano, calculada das avaliações guardadas, mais "últimos 12 meses" contra a nota geral); distribuição da nota geral.
- **Avaliações**: mais recentes primeiro, filtro "Só cargos de tecnologia" (ligado por padrão), prós/contras, conselho, tempo de casa; 8 por vez.
- **Entrevistas**: dificuldade, duração mediana, quantos aceitaram a oferta, barra de experiência, canais; relatos com cargos de tecnologia primeiro, processo e perguntas.
- **Salários**: faixa p10–p90, caixa p25–p75 e traço na mediana, alternando base/total, filtro "Só tecnologia", ordenado por nº de salários.

Cabeçalho: "Coletado em <data>", "Ver no Glassdoor" (`companies.glassdoor_url`, ou a URL do snapshot) e o botão de upload. Sem snapshot: estado vazio. A lista de empresas tem o mesmo botão (só ícone abaixo de `xl`); o resultado aparece com `Notice` (uma linha por empresa, mais os erros do coletor) e a tela é atualizada.

A regex de cargos de tecnologia vive em `src/lib/glassdoor/constants.ts` (`TECH_TITLE_PATTERN`). O servidor entrega no máximo 200 avaliações e 200 entrevistas mais recentes à tela; a tendência usa todas as avaliações guardadas.

## Armadilhas

- O upload manual passa por Server Action: `next.config.ts` sobe `serverActions.bodySizeLimit` para 10 MB (o padrão de 1 MB não cobre coleta completa de empresas grandes).
- `collected_at` é guardado em segundos; duas coletas da mesma empresa dentro do mesmo segundo colidem no índice único (tratado como duplicata).
- O payload tem texto de avaliações: só em `tmp/` (gitignored).
