# Referência: Route Handlers e Server Actions

Não há API pública nem autenticação. Tudo abaixo roda no mesmo processo Next e confia na rede (ver [arquitetura.md](arquitetura.md#segurança)).

## Route Handlers (`src/app/api/`)

| Método e rota | Arquivo | Runtime | Entrada | Resposta |
|---|---|---|---|---|
| `GET /api/monitoring/stream` | [`monitoring/stream/route.ts`](../src/app/api/monitoring/stream/route.ts) | `nodejs`, `force-dynamic` | — | `text/event-stream`; cada GET **inicia um run completo** do radar. Eventos em [radar-manual-de-vagas-implementacao.md](radar-manual-de-vagas-implementacao.md#streaming-sse) |
| `GET /api/monitoring/current` | [`monitoring/current/route.ts`](../src/app/api/monitoring/current/route.ts) | `force-dynamic`, `no-store` | — | `MonitoringRunSnapshot`: `{ status: "idle", run: null }` ou `{ status: "running" \| "stale", run: {...} }` (ver doc do radar) |
| `POST /api/profile/upload` | [`profile/upload/route.ts`](../src/app/api/profile/upload/route.ts) | `nodejs` | `multipart/form-data`, campo `file` (PDF ≤ 10 MB) | `{ ok: true, rawText, masterResumePath, originalFilename, size }` · 400 `{ ok: false, error }` (validação/PDF sem texto) · 500 |
| `POST /api/applications/[id]/resume` | [`applications/[id]/resume/route.ts`](../src/app/api/applications/[id]/resume/route.ts) | `nodejs` | FormData: `mode=empty` · `mode=unknown` · ou `file` (PDF ≤ 10 MB) | `{ ok: true, resumeStatus, resumePath?, originalFilename?, size? }` · 400/404/500 |
| `GET /api/applications/[id]/resume` | idem | `nodejs` | — | PDF inline com o nome original · 404 se `used_resume_status ≠ uploaded` |
| `GET /api/applications/[id]/generated-resume` | [`applications/[id]/generated-resume/route.ts`](../src/app/api/applications/[id]/generated-resume/route.ts) | `nodejs` | — | PDF inline · 404 sem currículo gerado · 500 se o arquivo sumiu |
| `GET /api/companies/[id]/logo` | `companies/[id]/logo/route.ts` | `nodejs`, `force-dynamic` | `?v=<hash>` opcional | bytes da imagem com CSP `sandbox`; cache `immutable` quando `v` confere · 404 `no-store` |

Convenções: `params` é `Promise<{ id: string }>` (await obrigatório); id não inteiro → 400 (na rota de logo → 404); erros de negócio em pt-BR no campo `error`.

## Server Actions

Todas em `src/server/actions/` com `"use server"`. Em geral devolvem resultado tipado em vez de lançar (exceções: `redirect()` em `createCompany`/`deleteCompany`, e erros inesperados de banco/`createApplicationRecord`).

### Radar e leads — [`job-monitoring.ts`](../src/server/actions/job-monitoring.ts), [`leads.ts`](../src/server/actions/leads.ts)

| Action | Assinatura | Efeito | Revalida |
|---|---|---|---|
| `runCompanyMonitoring` | `(companyId: number) => MonitoringActionResult` | radar de uma empresa (sem SSE, sem run-state) | radar views |
| `runAllCompaniesMonitoring` | `() => MonitoringActionResult` | radar de todas (sem SSE, sem run-state) | radar views |
| `runAllCompaniesMonitoringStream` | `(onEvent) => void` | usado só pela rota SSE | — |
| `approveLead` | `(leadId: number) => void` | `user_decision = approved` (ignora descartado/promovido) | radar views |
| `discardLead` | `(leadId: number) => void` | `classification_status = discarded`, `user_decision = dismissed` | radar views |
| `promoteApprovedLeadToApplication` | `(prev, formData) => ApplicationCreateResult` | cria job + candidatura, marca lead `promoted` | radar views |
| `getLeads` | `() => LeadListItem[]` | leitura (não descartados, `updated_at DESC`) | — |

"Radar views" = `/companies`, `/applications`, `/leads`. `MonitoringActionResult = MonitoringSummary & { success, label, error? }`.

### Candidaturas — [`applications.ts`](../src/server/actions/applications.ts)

| Action | Assinatura | Efeito |
|---|---|---|
| `createApplication` | `(prev, formData) => { success: true, id } \| { success: false, error: "validation" }` | job + candidatura; sincroniza status da empresa |
| `updateApplicationStatus` | `(id, status) => { success, error? }` | status + histórico (transação) + status da empresa |
| `createApplicationStage` | `(applicationId, formData{label,date,notes})` | nova etapa (data `YYYY-MM-DD`, gravada 12:00 local) |
| `updateApplicationStage` | `(stageId, formData)` | edita etapa |
| `deleteApplicationStage` | `(stageId)` | remove etapa |
| `updateApplicationNotes` | `(applicationId, notes)` | notas |
| `updateJobContext` | `(applicationId, { sourceName, workModel, seniority, isReferral })` | campos do job + `is_referral` |
| `updateApplicationDescription` | `(applicationId, description)` | `jobs.description` |
| `formatApplicationDescriptionWithAi` | `(rawDescription) => { success, formatted \| error }` | Ollama; não grava nada |

Mutações retornam `{ success: true } \| { success: false, error: "not_found" \| "validation" }` e revalidam `/applications` (e `/companies` quando mexem em status).

### Currículo — [`resume.ts`](../src/server/actions/resume.ts)

| Action | Assinatura | Efeito |
|---|---|---|
| `generateResume` | `(applicationId) => { success: true, filePath } \| { success: false, error }` | Ollama + LaTeX + `tectonic`; grava `generated_resume_path` (sem revalidar) |

### Empresas — [`companies.ts`](../src/server/actions/companies.ts)

| Action | Assinatura | Efeito |
|---|---|---|
| `createCompany` | `(formData)` | valida; erro → `redirect("/companies/new?error=validation")`; ok → insere, liga jobs por nome, `redirect("/companies/<id>")` |
| `updateCompany` | `(companyId, formData) => CompanyMutationResult` | atualiza; renomeia vínculos; limpa cache de logo se site/logo mudou |
| `deleteCompany` | `(companyId, { redirectToList? }) => CompanyMutationResult` | bloqueia com jobs ligados; apaga leads + empresa + logo |

`CompanyMutationResult = { ok: true } \| { ok: false, error: "validation" \| "not-found" \| "linked-applications" }`.

### Perfil — [`profile.ts`](../src/server/actions/profile.ts)

| Action | Assinatura | Efeito |
|---|---|---|
| `extractProfileDraft` | `({ rawText, masterResumePath }) => { ok, extractedProfile, summary } \| { ok: false, error }` | OpenAI; não grava |
| `saveExtractedProfile` | `({ extractedProfile, masterResumePath })` | grava preservando preferências de tipo de empresa/valores |
| `extractProfile` | `(input)` | rascunho + gravação (sem uso na UI) |
| `updateProfile` | `(data: ProfileReviewData) => { ok, savedAt } \| { ok: false, error }` | regrava perfil inteiro (apaga e reinsere filhos) |

Todas revalidam `/profile` quando gravam.

### Fontes agregadas — [`sources.ts`](../src/server/actions/sources.ts)

| Action | Assinatura | Efeito |
|---|---|---|
| `setSourceEnabledAction` | `(sourceId, enabled) => { ok }` | liga/desliga uma fonte |
| `runSourcesMonitoring` | `() => MonitoringActionResult` | roda as fontes habilitadas em sequência (sem SSE nem tracker) |
| `runSourceMonitoring` | `(sourceId) => MonitoringActionResult` | roda uma fonte, habilitada ou não |

`discoverCompanyAts(companyId)` (em `companies.ts`) devolve `{ ok: true, provider, boardUrl, jobsCount, via } \| { ok: false, error: "not-found" \| "has-board" \| "not-discovered" }`.

### Busca internacional — [`search-preferences.ts`](../src/server/actions/search-preferences.ts)

| Action | Assinatura | Efeito |
|---|---|---|
| `saveSearchPreferencesAction` | `(input: SearchPreferencesInput) => { ok: true, updatedAt } \| { ok: false, error: "validation" }` | normaliza (enums permitidos, números não negativos, palavras em minúsculas) e grava a linha única de `search_preferences`; fuso IANA desconhecido → `validation` |

## Queries de leitura fora das actions

- Páginas em `src/app/(app)/**/page.tsx` consultam o Drizzle direto.
- [`src/server/queries/dashboard.ts`](../src/server/queries/dashboard.ts): `resolvePeriod` e uma função por widget.
- [`src/lib/profile/queries.ts`](../src/lib/profile/queries.ts): `getProfileSnapshot()`.
- [`src/lib/search-preferences-queries.ts`](../src/lib/search-preferences-queries.ts): `getSearchPreferences()` (null = filtros desligados).
