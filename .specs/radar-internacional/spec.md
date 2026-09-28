# Spec: Radar internacional + triagem em 3 estágios + candidatura assistida

Status: aprovada pelo usuário em 2026-09-28. Branch: `feat/radar-internacional`.

## Contexto

O usuário mudou o foco para vagas remotas no exterior pagas em USD (contractor via Deel/EOR ou PJ é aceitável). O radar atual é orientado a empresa (`companies.jobs_board_url` → provider Greenhouse/Gupy/InHire → classificação Ollama). Esta spec adiciona:

1. providers Ashby e Lever (onde está a maioria das startups YC/Wellfound);
2. preferências de busca internacional (salário mínimo em USD, contratos, elegibilidade);
3. fontes agregadas (um feed → N empresas) + importação de empresas YC com descoberta de ATS;
4. triagem em 3 estágios (filtros duros em código → extração de elegibilidade → fit), com Jev (TypeSafe) como motor opcional e Ollama como fallback;
5. candidatura **assistida** (kit com currículo em inglês, cover letter, respostas do formulário, preenchimento local opcional). **Nunca** auto-submit.

Leia antes: `CLAUDE.md`, `docs/radar-manual-de-vagas-implementacao.md`, `docs/ia.md`, `docs/banco-de-dados.md`, `docs/modulos/curriculo.md`, `docs/modulos/candidaturas.md`, `docs/desenvolvimento-local.md`, `DESIGN.md`.

## Regras invioláveis (valem para toda a implementação)

- Repo é **público**: nunca commitar `.env*`, banco, `uploads/`, `backups/`, `tmp/`, dados pessoais, valores reais de salário/preferências do usuário, URL de produção ou nome do tailnet. Fixtures só com empresas e pessoas fictícias.
- Banco sintético (schema-only) na worktree; nunca copiar o banco real. `DATABASE_URL` apontando para o banco sintético.
- Nada de `npm run dev` na porta 3000. Preview, se necessário: build + `next start -p 3100` com banco sintético (receita em `docs/desenvolvimento-local.md`); encerrar ao terminar e reverter `launch.json`.
- **Sem auto-submit** de candidatura, sem resolver CAPTCHA, sem automatizar login, sem guardar senhas. O script de preenchimento para antes do botão de enviar.
- Não fazer push nem merge na `main` (push na `main` = deploy). Commits locais na branch, um por fase (Conventional Commits, mensagem em inglês).
- Testes sem rede: toda chamada HTTP recebe `fetchImpl` injetável (padrão já usado em `providers/`). Smoke tests manuais contra APIs públicas (GET) são permitidos fora da suíte.
- UI segue `DESIGN.md` (só tokens de `globals.css`, primitives de `src/components/ui/`, pt-BR, um botão roxo por tela, funciona no celular).
- Ao mudar comportamento documentado, atualizar a página de `docs/` no mesmo commit.
- Migrations: `npm run db:generate` → revisar SQL → `npm run db:migrate` no banco sintético. Colunas novas nullable ou com default (o deploy migra o banco de produção automaticamente, com dados existentes).
- Ao fim de cada fase: `npm run typecheck`, `npm run lint`, `npm test` passando.

---

## Fase 1: Providers Ashby e Lever

**Detecção** (`src/lib/job-monitoring/providers/index.ts`, modo `auto`):
- `jobs.ashbyhq.com/{org}` → `GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true`
- `jobs.lever.co/{org}` → `GET https://api.lever.co/v0/postings/{org}?mode=json`; `jobs.eu.lever.co/{org}` → `api.eu.lever.co`

**Mapeamento** para `DiscoveredLink.prefetched` (estender o tipo com `salaryText?`, `workModel?`, `applyUrl?`, `locationRestrictions?`):
- Ashby: só `isListed`; `title`, `descriptionHtml`, `location` + `secondaryLocations`, `isRemote`/`workplaceType` → workModel, `compensation.scrapeableCompensationSalarySummary` → salaryText, `jobUrl`, `applyUrl`, `id`.
- Lever: `text`, `descriptionPlain`/`description` + `lists` + `additionalPlain`, `categories.location`/`allLocations`, `workplaceType`, `salaryRange {min,max,currency,interval}` → salaryText, `hostedUrl`, `applyUrl`, `id`.

Adicionar `ashby`/`lever` às opções de ATS do formulário de empresa. Testes com fixtures JSON (recortadas, empresa fictícia).

## Fase 2: Preferências de busca internacional

Tabela nova `search_preferences` (linha única, lida por `getSearchPreferences()`; ausência = filtros desligados):

| coluna | tipo | uso |
|---|---|---|
| `min_monthly_usd` / `min_annual_usd` | integer null | piso salarial (compara com o que existir; mensal×12 vs anual) |
| `accepted_contracts` | text JSON | `employee`, `contractor`, `eor`, `pj` |
| `accepted_eligibility` | text JSON | `worldwide`, `americas`, `latam`, `brazil` |
| `timezone` | text | ex.: `America/Sao_Paulo` |
| `max_utc_offset_distance_hours` | integer null | distância máxima de fuso aceita |
| `target_seniorities` | text JSON | `junior`…`staff_plus` |
| `target_job_families` | text JSON | ex.: `backend`, `fullstack`, `frontend`, `data`, `devops`, `mobile`, `ai_ml` |
| `title_include_keywords` / `title_exclude_keywords` | text JSON | filtro de título do estágio 0 |
| `default_answers` | text JSON | respostas padrão de formulário (autorização de trabalho nos EUA, sponsorship, pretensão salarial, aviso prévio, "how did you hear", pronomes: vazio) |
| `updated_at` | timestamp | |

UI: nova seção em Perfil ("Busca internacional") com os campos acima. **Sem valores padrão pessoais no código** — o usuário preenche.

## Fase 3: Fontes agregadas, empresas automáticas, importação YC

### 3.1 Fontes

Tabela `job_sources`: `id`, `kind` (`himalayas|remoteok|weworkremotely|jobicy|hn_whoishiring`), `name`, `config` (JSON: categorias/tags), `enabled`, `last_run_at`, `last_cursor`, `last_error`, `created_at`. Seed idempotente em código das 5 fontes (habilitadas) na primeira leitura.

Cada fetcher (`src/lib/job-monitoring/sources/<kind>.ts`) devolve `SourceJob[]`:
`{ sourceKind, externalId, url, applyUrl?, title, companyName, companyWebsite?, descriptionHtml?, descriptionText?, locationText?, locationRestrictions?: string[], timezoneRestrictions?: number[], salary?: {min?, max?, currency?, period?: "year"|"month"|"hour"}, seniority?, employmentType?, publishedAt? }`

Endpoints verificados em 2026-09-28 (confira o formato real com um GET antes de codar):
- **Himalayas**: `https://himalayas.app/jobs/api?limit=…&cursor=…` (paginação por `nextCursor`; campos `locationRestrictions`, `timezoneRestrictions`, `minSalary`, `maxSalary`, `currency`, `salaryPeriod`, `seniority`, `applicationLink`, `guid`, `pubDate`). Parar ao chegar em `pubDate` ≤ último run.
- **RemoteOK**: `https://remoteok.com/api` (exige User-Agent; o item 0 é aviso legal, ignorar). Mostrar "via Remote OK" com link no lead (termos pedem atribuição).
- **We Work Remotely**: RSS `https://weworkremotely.com/categories/remote-programming-jobs.rss` (+ categorias do `config`). Título "Empresa: Cargo"; campo `region`. Parse com cheerio `xmlMode`.
- **Jobicy**: `https://jobicy.com/api/v2/remote-jobs?count=50&tag=…` (campos de geo e salário anual; creditar a fonte).
- **HN Who's Hiring**: story mais recente em `https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring` cujo título contém "Who is hiring"; comentários em `https://hn.algolia.com/api/v1/items/{id}`; só top-level; só os que mencionam `remote`; primeira linha no formato `Empresa | Cargo | Local | …` (parse em código; se falhar, empresa = 1º segmento, título = "Vaga (HN)"). URL: `https://news.ycombinator.com/item?id={commentId}`.
- Remotive fica de fora (feed público com ~16 vagas).

Rede: timeout 20 s, User-Agent identificando uso pessoal, fontes em sequência.

### 3.2 Empresa automática e dedup

- `companies.origin` (`manual` default | `aggregator` | `yc_import`). Resolver empresa por nome normalizado (minúsculas, sem acento/pontuação, sem sufixos `inc|llc|ltd|gmbh|s.a.|corp|co`) e, se houver, domínio do site. Não encontrou → cria com `origin=aggregator`, `status=monitoring`, `radar_enabled=false` se não houver ATS conhecido. Na lista de empresas, `Tag` "via agregador"/"YC" e filtro por origem.
- `job_leads` ganha: `source_kind`, `external_id`, `apply_url`, `dedup_key` (hash de empresa normalizada + título normalizado), colunas de triagem (Fase 4). Antes de processar: se já existe lead com o mesmo `dedup_key` nos últimos 60 dias → `link-skipped`; se o novo vem de ATS e o existente de agregador, atualizar `apply_url`/`source_url` para o do ATS.
- Integração com o run: no `bulk-run`, depois das empresas, cada fonte habilitada roda como uma etapa (reusar `company-start`/`company-done` com `company: "Fonte: <nome>"`; sem novos tipos de evento SSE, salvo se inevitável — aí atualizar o client e a doc). Também Server Action `runSourcesMonitoring()` e página/aba "Fontes" (lista, toggle, último run, último erro, botão rodar).

### 3.3 Importação YC + descoberta de ATS

- `src/lib/companies/ats-discovery.ts`: dado um site, buscar homepage e `/careers`, `/jobs` e procurar links `jobs.ashbyhq.com/{x}`, `jobs.lever.co/{x}`, `boards.greenhouse.io/{x}`, `job-boards.greenhouse.io/{x}`. Fallback: testar o slug da empresa direto na API da Ashby/Lever/Greenhouse (200 com vagas = aceito). **Reusar o bloqueio de IP privado/loopback/tailnet e o redirect manual de `src/lib/company-logos.ts`** (extrair helper compartilhado se preciso).
- Script `npm run companies:import-yc` (+ lib reutilizável): lê `https://yc-oss.github.io/api/companies/all.json`, filtra `isHiring && status === "Active"` e (`regions` inclui "Remote" ou `all_locations` contém "Remote"); em 2026-09-28 eram ~750 empresas. Upsert por nome/domínio com `origin=yc_import`; roda a descoberta com `pLimit(5)`; ATS encontrado → `jobs_board_url` + `ats_provider` + `radar_enabled=true`; senão `radar_enabled=false`. Idempotente, com resumo no final. Flag `--dry-run`.
- Botão "Descobrir ATS" no detalhe da empresa (usa a mesma lib).

## Fase 4: Triagem em 3 estágios

Módulo `src/lib/job-monitoring/triage/`. Substitui a chamada direta a `classifyJobLead` no pipeline (fontes e empresas) por `triageJob(job, ctx)`, com o mesmo contrato de saída para a persistência e a UI (`decision`, `score`, `reason`, sinais), além dos campos novos.

Colunas novas em `job_leads`: `eligibility`, `contract_types` (JSON), `salary_min_usd_annual`, `salary_max_usd_annual`, `discard_reason`, `user_discard_reason`, `triage_engine`, `triage_model`, `triage_confidence` (real), `triage_details` (JSON com todas as respostas/probabilidades).

Enum `discard_reason`: `location_ineligible`, `salary_below_min`, `job_family_mismatch`, `seniority_mismatch`, `contract_mismatch`, `low_fit`, `other`.

### Estágio 0: filtros duros (código puro, sem modelo)

`hardFilters(job, prefs) → { pass: true } | { pass: false, reason, detail }`:
- título: `title_exclude_keywords` ou nenhuma `title_include_keywords`/família → `job_family_mismatch` (este corte vem primeiro e barra o volume de milhares de vagas das empresas importadas);
- `locationRestrictions` estruturado (Himalayas etc.) sem país/região aceita → `location_ineligible`;
- regex de alta precisão: `US only`, `must (be located|reside|be based) in the (US|United States)`, `authorized to work in the (US|United States)` + `(without|no) sponsorship`, `EU only`, `UK only`, `(Canada|Europe) only` → `location_ineligible` (casos ambíguos passam adiante);
- salário conhecido **em USD**, normalizado para anual (mensal×12, hora×2080) com máximo < piso → `salary_below_min`; outra moeda não descarta.
Descartes do estágio 0 são gravados (`discarded`, score 0, `triage_engine = "rules"`) para o skip funcionar.

### Estágio 1: extração de elegibilidade/contrato (Jev ou Ollama)

State enxuto montado em código (Jev sofre com contexto irrelevante): título, local, workModel, salário bruto e **só as frases da descrição** que mencionam local/remote/timezone/visa/sponsor/contract/salary/compensation, mais os primeiros ~1.500 caracteres. Limite ~6k tokens.

Perguntas (em inglês; o conteúdo das vagas é em inglês):
- `eligibility` (Choice): `worldwide` | `americas_or_latam_incl_brazil` | `brazil_explicit` | `us_only` | `us_canada_only` | `europe_uk_only` | `other_country_restricted` | `not_stated` — critérios com casos de fronteira ("Remote (US)" = us_only; "Remote, Americas" = americas…).
- `us_work_authorization_required` (Noul).
- `contract` (Choice): `employee_only` | `contractor_or_eor_ok` | `not_stated`.
- `timezone` (Choice): `no_requirement` | `americas_overlap` | `us_pacific_hours` | `europe_hours` | `apac_hours` | `not_stated`.
- `seniority` (Choice): `intern` | `junior` | `mid` | `senior` | `staff_plus` | `manager` | `not_stated`.
- `job_family` (Choice): as famílias da preferência + `other`.
- `salary_span` (Choice): padrão "pre-parsed value extraction" — regex em código acha candidatos (`$120k–$150k`, `USD 8,000/month`…), a Jev escolhe qual é a faixa-base da vaga (ou `none`); **toda a conta fica em código** (Jev não faz aritmética).

Regras em código após o estágio 1: elegibilidade restrita com `confidence ≥ 0.8` → descarta `location_ineligible`; confiança menor → força `review`. `employee_only` com `us_work_authorization_required > 0.7` → `contract_mismatch`. Salário abaixo do piso → `salary_below_min`.

### Estágio 2: fit (composite scoring)

Score (5 níveis cada), com o perfil em `instructions` estruturadas (**só** skills, anos, senioridade, famílias; nunca nome/e-mail/telefone):
- `stack_match`, `seniority_match`, `domain_interest` (preferências de tipo de empresa/valores do perfil);
- Noul `red_flags` (commission-only, não remunerado, "unpaid trial", cripto duvidoso).
Pesos em código (constante documentada) → score 0–100. `≥ 70` interesting; `30–69` review; `< 30` discarded `low_fit`. Qualquer resposta decisiva com confiança baixa → `review` (o projeto prefere `review` a `discarded`).

`reason` em pt-BR montado em código a partir das respostas (Jev não gera texto), ex.: `Elegível: Américas (0,91) · contractor ok · sênior · stack forte (4,2/5) · US$ 120–150 mil/ano`.

### Motores

- `src/lib/ai/typesafe.ts`: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`, body `{ state, model, questions }`, tipos `noul`/`choice`/`score` (docs: https://docs.typesafe.ai/api.md, limites em https://docs.typesafe.ai/models.md, cuidados em https://docs.typesafe.ai/model-jaggedness/jev-1.13.md). `fetch` puro com `fetchImpl` injetável (sem SDK), timeout, retry em 429 honrando `retry-after` (máx. 3), log do `model` e do `usage`. Todas as perguntas de um estágio vão numa chamada só.
- Env: `TRIAGE_ENGINE` = `ollama` (default, mantém o comportamento atual) | `jev`. `jev` sem `TYPESAFE_API_KEY` → erro de configuração (fail closed). `TYPESAFE_MODEL` default `jev-1.13.0` (versão fixa, não o alias). Documentar em `.env.example`, na tabela do `CLAUDE.md` e em `docs/ia.md`.
- Fallback Ollama: implementar o mesmo contrato `TriageAnswers` (estágios 1 e 2) com uma chamada JSON-schema ao Ollama; o código a jusante é idêntico. O classificador atual (`classification.ts`) pode ser absorvido; manter o comportamento "sem perfil → review/40".
- O conteúdo das vagas é não confiável (prompt injection): filtros em código têm a palavra final, e o modelo nunca promove algo que o estágio 0 descartou.

### Feedback e insights

- Ao descartar manualmente um lead, chips opcionais de motivo (enum + `not_interested`) → `user_discard_reason`. `feedback.ts` passa a usar esses motivos.
- Dashboard: painel "Radar internacional" com leads por fonte, % elegíveis, distribuição de `discard_reason` e mediana de salário (USD/ano) dos elegíveis.
- Script `npm run triage:eval`: roda a triagem sobre ~20 vagas fictícias em `src/lib/job-monitoring/triage/__fixtures__/` com rótulos esperados e imprime acerto por pergunta e por motor (com Jev, se houver chave). Serve para calibrar os limiares quando a chave chegar.

## Fase 5: Candidatura assistida

Tabela `application_kits`: `id`, `application_id` (FK, único), `language` (`en`), `apply_url`, `resume_path`, `cover_letter`, `form_fields` (JSON), `answers` (JSON), `status` (`draft|ready|submitted_by_user`), `created_at`, `updated_at`.

Fluxo "Preparar candidatura" (no detalhe da candidatura; também ao promover um lead internacional):
1. **Currículo em inglês**: `generateResume(applicationId, { language: "en" })`. Prompt em inglês; `profile-adapter` sem textos fixos em pt ("Portuguese — Native", "English — Advanced", "Brazil"); cabeçalhos do template localizados; preencher `headline`/`summary` (o template já suporta). O fluxo pt-BR atual continua igual.
2. **Cover letter** (Ollama, generativo): 120–180 palavras, inglês, sem inventar fatos, baseada no perfil e na vaga. Editável.
3. **Campos do formulário**:
   - Greenhouse: `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}?questions=true`;
   - Lever: HTML de `https://jobs.lever.co/{org}/{id}/apply` via cheerio (campos padrão + cards customizados);
   - Ashby e demais: Playwright headless (dependência existente) lê labels/tipos/obrigatoriedade/opções; não clica em nada que envie. Login/CAPTCHA detectado → campos desconhecidos, preenchimento manual.
4. **Mapeamento campo → resposta**: heurística em código (name/type/label) primeiro; o resto via Jev Choice sobre as chaves `full_name, first_name, last_name, email, phone, linkedin, github, portfolio, location, resume_upload, cover_letter, us_work_authorization, requires_sponsorship, salary_expectation, notice_period, timezone, years_experience, how_did_you_hear, eeo_demographic, free_text, unknown` (Ollama no fallback). Confiança baixa → `unknown`. Respostas vêm do perfil e de `search_preferences.default_answers`. **Perguntas EEO/demográficas: nunca responder; deixar para o usuário.** `free_text` → rascunho do Ollama marcado "rascunho IA".
5. **UI** `/applications/[id]/kit`: campos com resposta, botão copiar por campo, edição inline, download do PDF, cover letter, link "Abrir formulário", botão "Marquei como enviada" (usa a troca de status existente → `applied` + `appliedAt`). Mobile-first.
6. **Preenchimento local** (opcional): `GET /api/applications/[id]/kit` (JSON) + script `npm run apply:fill -- --app-url <url> --application <id>` que roda **na máquina do usuário** (a VPS não tem display): Playwright headed com perfil persistente em `tmp/`, abre o `apply_url`, preenche os campos mapeados, anexa o currículo, destaca os `unknown`, **não clica em enviar** e deixa a janela aberta. Em CAPTCHA/login, para de preencher e avisa no terminal.

## Fase 6: Docs e fechamento

Atualizar `docs/radar-manual-de-vagas-implementacao.md`, `docs/ia.md`, `docs/banco-de-dados.md`, `docs/modulos/{leads,candidaturas,curriculo,empresas,perfil,dashboard}.md`, `docs/roadmap-e-decisoes.md` (decisões: Jev opcional, fontes agregadas, candidatura assistida), `docs/problemas-conhecidos.md` (limitações novas), `CLAUDE.md` (env vars, fontes, triagem) e `.env.example`. Suíte, typecheck e lint verdes.

## Critérios de aceite

- Empresa com URL Ashby/Lever gera leads com salário e local preenchidos.
- As 5 fontes rodam dentro do "Rodar radar" com progresso SSE, criam empresas quando preciso e não duplicam a mesma vaga vinda de fontes diferentes.
- `companies:import-yc --dry-run` lista as empresas e os ATS encontrados sem gravar.
- Vaga "US only" é descartada no estágio 0 sem chamar modelo; vaga "Remote (Americas), contractor, US$ 140k" vira `interesting` com `reason` legível.
- `TRIAGE_ENGINE=jev` sem chave falha na inicialização da triagem com mensagem clara; com `ollama`, tudo funciona como antes para as empresas atuais.
- O kit de candidatura mostra currículo em inglês, cover letter e respostas copiáveis; o script de preenchimento nunca envia.
- Nenhum dado pessoal ou segredo nos commits.
