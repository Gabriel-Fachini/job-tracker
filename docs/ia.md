# Camada de IA

Três provedores, cada um com papel definido (revisão de 2026-09-28: **OpenAI é o padrão** para triagem e geração; os modelos mais fortes do Ollama Cloud exigem plano pago):

- **OpenAI** (padrão): triagem dos leads (`TRIAGE_ENGINE=openai`), tarefas generativas (`GENERATION_ENGINE=openai`), extração do perfil a partir do PDF (obrigatório para esse fluxo) e, opcionalmente, formatação de descrições no radar.
- **TypeSafe / Jev** (opcional): motor da triagem com `TRIAGE_ENGINE=jev`, probabilidades calibradas. Sem chave, não é usado.
- **Ollama** (local ou Ollama Cloud): **fallback** da triagem (`TRIAGE_ENGINE=ollama`) e da geração (`GENERATION_ENGINE=ollama`). O código e as variáveis continuam; removê-lo por completo é uma tarefa futura.

Código em [`src/lib/ai/`](../src/lib/ai/) e [`src/lib/job-monitoring/triage/`](../src/lib/job-monitoring/triage/).

## Variáveis de IA

| Variável | Default | Uso |
|---|---|---|
| `TRIAGE_ENGINE` | `openai` | `openai` \| `jev` \| `ollama`. Valor inválido, ou motor sem a chave dele, falha a triagem na largada do run (mensagem clara; nada é gravado) |
| `OPENAI_TRIAGE_MODEL` | `gpt-6-luna` | modelo da triagem com `openai`: `reasoning: { effort: "none" }` e saída estruturada estrita. Referência de preço (2026-09-28): US$ 0,10 / 0,50 por 1M tokens (entrada/saída) |
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai` | endpoint = `<base>/v1/systemone`; aceita qualquer servidor com o mesmo contrato (ver "Jev autohospedado") |
| `TYPESAFE_API_KEY` | — | obrigatória com `jev` **só no host oficial** (`api.typesafe.ai`; sem ela a triagem falha na largada). Em outro host, o header `Authorization: Bearer` só vai se houver chave |
| `TRIAGE_MAX_STATE_TOKENS` | `6000` | orçamento do state dos estágios 1 e 2 (estimativa chars/4). Ver "Estados enxutos" |
| `TYPESAFE_MODEL` | `jev-1.13.0` | versão **fixa** (não o alias `jev-latest`), para que os limiares calibrados não mudem sozinhos |
| `TYPESAFE_TIMEOUT_MS` | `30000` | por chamada |
| `GENERATION_ENGINE` | `openai` | `openai` \| `ollama` |
| `OPENAI_GENERATION_MODEL` | `gpt-6-sol` | modelo generativo com `openai`: `reasoning: { effort: "low" }`. Referência: US$ 2 / 10 por 1M tokens |
| `OPENAI_COMPARISON_MODEL` | `gpt-6-sol` | extração do perfil a partir do PDF (era `gpt-5.4`; não deixe definida e vazia) |
| `OPENAI_FORMAT_MODEL` | `gpt-6-luna` | formatação opcional de descrições do radar (`OPENAI_FORMAT_JOB_DESCRIPTIONS=true`), `reasoning: none` (era `gpt-4o-mini` fixo) |
| `OPENAI_API_KEY` | — | obrigatória com `openai` (triagem/geração) e na extração de perfil |

Privacidade: qualquer provedor recebe só o texto da vaga e, do perfil, habilidades, anos de experiência, senioridade, famílias-alvo e as preferências de tipo de empresa/valores; **nunca nome, e-mail, telefone, links ou localização** (teste em `triage.test.ts`). A geração de currículo e de cover letter envia conteúdo do perfil por natureza (comportamento que já existia para o currículo).

## Onde cada modelo é usado

| Tarefa | Provedor | Função | Modelo | Parâmetros |
|---|---|---|---|---|
| Triar lead do radar (estágios 1 e 2) | `TRIAGE_ENGINE`: OpenAI (padrão) / Jev / Ollama | `triageJob` → `engines/*` | `OPENAI_TRIAGE_MODEL` / `TYPESAFE_MODEL` / `OLLAMA_MODEL` | OpenAI: Responses API com `json_schema` estrito, 1 chamada por estágio. Jev: 1 chamada por estágio. Ollama: `format` = mesmo JSON Schema, `temperature 0`, `think: false` |
| Selecionar bullets/skills do currículo | `GENERATION_ENGINE`: OpenAI (padrão) / Ollama | `generateResumeSelection` → `generateText` | `OPENAI_GENERATION_MODEL` / `OLLAMA_MODEL` | OpenAI: `json_object`; Ollama: `format: "json"`, `temperature 0` |
| Botão "Formatar" na candidatura | `GENERATION_ENGINE` | `formatJobDescription` | idem | OpenAI: texto livre até 4000 tokens; Ollama: `temperature 0.1`, `think: false` |
| Classificar lead (legado) | Ollama | `classifyJobLead` | `OLLAMA_MODEL` | **não é mais chamado pelo pipeline**; fica como classificador injetável nos testes |
| Extrair perfil do currículo | OpenAI | `extractProfileWithOpenAi` | `OPENAI_COMPARISON_MODEL` (default `gpt-6-sol`) | Responses API, `json_schema` estrito, `max_output_tokens 16000` |
| Formatar descrição no radar (opt-in) | OpenAI | `formatJobDescriptionAsMarkdown` | `OPENAI_FORMAT_MODEL` (default `gpt-6-luna`, `reasoning: none`) | `max_output_tokens 4000`; só com `OPENAI_FORMAT_JOB_DESCRIPTIONS=true` |
| Extrair perfil via Ollama | Ollama | `extractProfileFromText` | `OLLAMA_MODEL` | **sem chamador** hoje |
| Comparar extrações Ollama × OpenAI | ambos | `compareProfileExtraction` | ambos | **sem chamador** hoje |

## Ollama

[`src/lib/ai/ollama.ts`](../src/lib/ai/ollama.ts).

### Configuração (`getOllamaConfig`)

Lida a cada chamada (não há cache), e lança `OllamaConfigurationError` quando falta algo:

| Variável | Regra |
|---|---|
| `OLLAMA_RUNTIME_MODE` | obrigatória, `local` ou `cloud` (sem default) |
| `OLLAMA_BASE_URL` | obrigatória; barra final removida. Local típico: `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | obrigatória (ex.: `gemma3:4b`) |
| `OLLAMA_API_KEY` | obrigatória em `cloud`; enviada como `Authorization: Bearer` só em `cloud` |
| `OLLAMA_TIMEOUT_MS` | opcional, default `240000` (inteiro > 0) |

O ambiente de uso atual é `cloud`: a classificação roda via HTTP remoto. O hook de início de sessão avisa se alguma das quatro primeiras faltar no `.env.local`.

### `callOllamaLlm(prompt, options)`

- `POST {base}/api/generate` com `model`, `prompt`, `system`, `format`, `think`, `stream: false`, `options` (geração) e `keep_alive` (default `0`, descarrega o modelo ao responder).
- Timeout via `AbortController` (`options.timeoutMs` ou `OLLAMA_TIMEOUT_MS`).
- Erros viram `OllamaRequestError`: HTTP não-2xx (mensagem em inglês, com status, modelo e corpo), resposta sem texto, timeout e falha de rede (mensagens em pt-BR).
- Retorna só `data.response` (string).

### `unloadOllamaModelIfLocal()`

Só em `local`: manda `prompt: ""` com `keep_alive: 0` e confere `done_reason === "unload"`. Se falhar, tenta `ollama stop <modelo>` via CLI. A classificação chama isso após cada lead; a extração de perfil, ao final. Em `cloud` não faz nada.

### Parse e validação do perfil

`parseExtractedProfileResponse` (usado também pela extração OpenAI) recorta o JSON (cercas, primeiro `{`…último `}`), valida o shape e normaliza:

- enums com aliases pt/en (ex.: "remoto" → `remote`, "avançado" → `advanced`, "ferramenta" → `tool`, "comportamental" → `soft-skill`);
- datas para `YYYY-MM` (ano sozinho → `AAAA-01`; datas opcionais inválidas → `null` sem derrubar a extração).

## OpenAI

[`src/lib/ai/openai.ts`](../src/lib/ai/openai.ts). SDK oficial (`openai` v6), **Responses API** (`client.responses.create`).

- `getOpenAiComparisonConfig()` exige `OPENAI_API_KEY` (senão `OpenAiComparisonConfigurationError`) e lê `OPENAI_COMPARISON_MODEL` (default `gpt-6-sol`). Atenção: variável definida porém vazia vira modelo `""`.
- `extractProfileWithOpenAi(rawText)`: prompt de sistema em pt-BR ("seja exaustivo, não invente, preserve bullets, trate educação com a mesma atenção"), schema `profile_extraction` estrito. `incomplete_details` (ex.: limite de tokens) vira erro explicativo.
- `formatJobDescriptionAsMarkdown(text)`: pede `##` por seção, listas com `-`, **negrito** em tecnologias, sem inventar nem parafrasear, no idioma original.

## Triagem em 3 estágios

Módulo [`src/lib/job-monitoring/triage/`](../src/lib/job-monitoring/triage/). `triageJob(job, ctx)` devolve o mesmo contrato do classificador antigo (`decision`, `score`, `reason` em pt-BR, sinais) mais os campos novos (`eligibility`, `contract_types`, `salary_*_usd_annual`, `discard_reason`, `triage_engine`, `triage_model`, `triage_confidence`, `triage_details`).

1. **Estágio 0, filtros duros** (`hard-filters.ts`, código puro, sem modelo): título (`title_exclude_keywords`; sem `title_include_keywords`/família no título → `job_family_mismatch`), `locationRestrictions` estruturado sem região aceita, frases de alta precisão ("US only", "must be located in the US", "authorized to work in the US" + "no sponsorship", "EU/UK/Canada/Europe only"), distância de fuso e salário em **USD** conhecido abaixo do piso (mensal×12, hora×2080; outra moeda nunca descarta). Descartes são gravados (`discarded`, score 0, `triage_engine = rules`). Sem preferências salvas, o estágio 0 não faz nada.
2. **Estágio 1, extração** (modelo): state enxuto (título, local, modelo de trabalho, salário bruto, ~1.500 caracteres de introdução e só as frases que falam de local/remote/timezone/visa/contrato/salário; teto ~20 mil caracteres ≈ 6k tokens). Perguntas: `eligibility` (8 opções), `us_work_authorization_required` (sim/não), `contract`, `timezone`, `seniority`, `job_family` (as famílias da preferência + `other`) e `salary_span` (o **código** acha candidatos `$120k–$150k`/`USD 8,000/month` e o modelo só escolhe qual é a faixa-base; a conta, em código). Regras em código depois: elegibilidade restrita (`us_only`, `us_canada_only`, `europe_uk_only`, `other_country_restricted`) → `location_ineligible` (com a Jev, só com confiança ≥ 0,8, abaixo disso `review`; com OpenAI/Ollama basta a resposta explícita, porque a confiança deles não é calibrada); elegibilidade ou contrato `not_stated` → `review`, nunca descarte; `employee_only` com autorização nos EUA > 0,7 → `contract_mismatch` (também quando o usuário não aceita contrato de empregado); salário abaixo do piso; senioridade/família fora do alvo com confiança ≥ 0,8.
3. **Estágio 2, fit** (modelo): `stack_match`, `seniority_match`, `domain_interest` (5 níveis cada; só se o perfil tem preferência de tipo de empresa/valores) e `red_flags` (sim/não). O perfil vai estruturado: habilidades, anos, senioridade, famílias. Pesos em `FIT_WEIGHTS` (0,45 / 0,30 / 0,25; renormalizados sem `domain_interest`) → score 0–100: ≥ 70 `interesting`, 30–69 `review`, < 30 `discarded` (`low_fit`). `red_flags` ≥ 0,85 descarta (`other`); ≥ 0,5 tira 25 pontos e limita a `review`.

Regra de ouro: **`review` em vez de descartar/promover na dúvida**. Resposta decisiva com confiança < 0,6, elegibilidade "não informada" ou restrição com pouca confiança limitam o lead a `review` (o motivo diz o que revisar). Filtros em código têm a palavra final: o modelo nunca promove o que o estágio 0 descartou, e o texto da vaga (não confiável, possível prompt injection) segue tratado como dado nos prompts. Constantes em [`rules.ts`](../src/lib/job-monitoring/triage/rules.ts) (`TRIAGE_THRESHOLDS`, `FIT_WEIGHTS`).

`reason` é montado em código, ex.: `Elegível: Américas/LATAM (0,91) · contractor ok · sênior · stack forte (4,4/5) · US$ 140–160 mil/ano.` Sem perfil salvo, depois do estágio 0: `review`/40 sem chamar o modelo.

### Motores

- **openai** (padrão): limites do tier 1 (500 RPM, 500k TPM) cabem no `pLimit(5)` do radar (até 2 chamadas por vaga). [`engines/json-engine.ts`](../src/lib/job-monitoring/triage/engines/json-engine.ts) → [`openai-runtime.ts`](../src/lib/ai/openai-runtime.ts). Cada pergunta vira um objeto do `json_schema` estrito: escolha = `{ value: enum, confidence: low|medium|high }`, sim/não = `{ answer: yes|no|unclear, confidence }`, nível = `{ level: 1..5, confidence }`. A confiança rotulada vira 0,4 / 0,7 / 0,9 em código e vai **só para o log** (`triage_details`, `triage_confidence`): no eval de 2026-09-29 todo erro do `gpt-6-luna` veio com `high`. Por isso, com motor não calibrado, descarte automático exige resposta explícita (restrição de local, `employee_only` com autorização nos EUA) e nenhum limiar de confiança é aplicado. Senioridade `not_stated` (comum em títulos sem nível, como "Backend Engineer") é neutra no fit.
- **jev**: [`src/lib/ai/typesafe.ts`](../src/lib/ai/typesafe.ts), `POST {TYPESAFE_BASE_URL}/v1/systemone` (default `https://api.typesafe.ai`) com `Authorization: Bearer` (quando há chave), `{ state, model, questions }` (tipos `noul`/`choice`/`score`), `fetch` puro com `fetchImpl` injetável, timeout, retry em 429 e 529 honrando `retry-after` (máx. 3; sem o header, backoff 1/2/4 s), log do `model` e do `usage` por chamada. Confiança e probabilidades calibradas. Notas do fabricante ([jaggedness do 1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md)): leitura literal, sem aritmética, sem datas, estado grande atrapalha — por isso a conta do salário e as regras ficam em código e o state é enxuto. Contexto máximo 64k tokens (32k para state + a maior pergunta). Nunca testado contra a API real (sem chave); a suíte usa `fetch` falso.
- **ollama**: o mesmo schema e prompt como `format` no `/api/generate`. Fallback.
- Sem a chave do motor escolhido, o run **falha antes de começar** (`assertTriageConfigured`, chamado por `loadRunContext`).

### Jev autohospedado (Laya)

Como o cliente só depende do contrato `POST /v1/systemone`, dá para apontar `TYPESAFE_BASE_URL` para um servidor compatível autohospedado, por exemplo o `laya-serve` (open source, mesmo contrato; ex.: `TYPESAFE_BASE_URL=http://127.0.0.1:8000`), em vez de pagar a TypeSafe. Nesse caso a chave é opcional, o `model` que o servidor devolve (o nome do checkpoint dele) é o que vai para o log `[triage] [jev] … model=…` e para `triage_model`, e vale ajustar:

- `TYPESAFE_MODEL` para o nome que o servidor espera;
- `TRIAGE_MAX_STATE_TOKENS`: os checkpoints do Laya leem de forma confiável ~768–4000 tokens, então reduza (ex.: `2000`). O servidor limita também os tokens gastos nas opções de cada pergunta, por isso os rótulos e critérios das perguntas são curtos (≤ 130 caracteres, teste em `triage.test.ts`).

A suíte usa `fetch` falso. **Avaliado e rejeitado para a triagem em 2026-09-29** (ver abaixo): o suporte a `TYPESAFE_BASE_URL` fica porque não custa nada, mas não há serviço Laya no deploy.

### Avaliação de motores (2026-09-29)

30 vagas fictícias rotuladas (casos de fronteira: "Remote (US)", Américas/LATAM, US-only disfarçado de remoto, tentativa de prompt injection, 2 vagas em pt-BR, horário do Pacífico, contractor × W-2), 4 perguntas do estágio 1. Laya 0.3.21 rodando em CPU (`laya-serve`), OpenAI com `reasoning: none`.

| Motor | Elegibilidade | Contrato | Senioridade | Fuso | Total | p50 |
|---|---|---|---|---|---|---|
| Laya `english` (421M) | 11/30 | 20/29 | 14/30 | 5/28 | 50/117 | 0,5 s |
| Laya `multilingual` (322M) | 11/30 | 13/29 | 10/30 | 11/28 | 45/117 | 0,2 s |
| `gpt-6-luna` | 28/30 | 27/29 | 22/30 | 25/28 | 102/117 | 1,5 s |
| `gpt-6-sol` | 29/30 | 28/29 | 22/30 | 25/28 | 104/117 | 2,0 s |

Com a pergunta reduzida a sim/não ("alguém no Brasil pode se candidatar?"), a Laya acertou 16–19 de 26. Conclusões: `gpt-6-luna` é o padrão (empata com o `gpt-6-sol` na elegibilidade a 1/20 do custo); a Laya não serve para elegibilidade; a confiança auto-relatada da OpenAI não separa acerto de erro. Os erros de senioridade são quase todos `not_stated` em títulos sem nível (rótulos discutíveis). A Jev oficial não foi avaliada (sem crédito).

### Estados enxutos

Os estados dos estágios 1 e 2 respeitam `TRIAGE_MAX_STATE_TOKENS` (chars/4): título, local, salário, introdução da descrição (no máximo metade do orçamento) e só as frases sobre local/contrato/salário; o estado é encolhido (frases, depois introdução, depois candidatos de salário) até caber. No estágio 2 a descrição ocupa o que o perfil do candidato deixa livre do mesmo orçamento (a Jev lê vaga e candidato como um estado só).

### Calibração

`npm run triage:eval` (agnóstico ao motor: mesmas vagas e mesma pontuação para `openai`, `jev` oficial ou `jev` em qualquer `TYPESAFE_BASE_URL`, via `--jev-base-url`) roda o estágio 0 (offline) e cada motor configurado sobre ~20 vagas fictícias ([`__fixtures__/eval-jobs.ts`](../src/lib/job-monitoring/triage/__fixtures__/eval-jobs.ts)) e imprime a acurácia por pergunta (`--engines jev,openai,ollama`). Use os números para ajustar `TRIAGE_THRESHOLDS`, principalmente com a chave da Jev.

## Prompts do classificador legado (resumo)

> O classificador abaixo (Ollama, uma chamada) **não é mais usado pelo pipeline**; a triagem acima o substituiu. O arquivo permanece para os testes de parse e como classificador injetável.

System prompt ([`classification.ts`](../src/lib/job-monitoring/classification.ts)):

- responder só JSON; não inventar requisitos, experiência ou preferências;
- **alta cobertura**: na dúvida, `review` em vez de `discarded`; `discarded` só com desalinhamento claro e sustentado; perfil incompleto → `review`;
- `score` inteiro 0–100; `reason` curto em pt-BR; arrays de sinais com frases curtas em pt-BR.

User prompt: JSON com empresa, perfil resumido, vaga, sinais extraídos, avaliação determinística, feedback recente (3 promovidos + 3 descartados) e critérios. Detalhes em [radar-manual-de-vagas-implementacao.md](radar-manual-de-vagas-implementacao.md#7-classificação-classifyjoblead).

Ao mexer em prompts, rode `npm run test:job-monitoring` (os testes de parse) e confira alguns leads reais no log `classification-finished`.

## Logs e privacidade

| Arquivo | Conteúdo |
|---|---|
| `tmp/logs/profile-extraction-raw-output-*.txt` | saída bruta da extração via Ollama (quando usada) |
| `tmp/logs/profile-extraction-openai-raw-output-*.txt` | saída bruta da OpenAI (perfil completo) |
| `tmp/logs/profile-extraction-error-*.json` | erro + primeiros 20 000 caracteres do currículo |

O caminho é relativo ao `cwd` do processo (na VPS, a release ativa). `tmp/` está no `.gitignore`. Esses arquivos têm dados pessoais: não compartilhe nem anexe em issues.

Além disso, o stdout do servidor recebe o motivo de cada classificação e a seleção completa do currículo (`[resume] aiSelection:`).

## Custo e latência

- Referência medida em 2026-05 (classificador Ollama, uma chamada): ~2 s por link no radar (extração + classificação), ~20 s para 50 links com `pLimit(5)`. A triagem faz até duas chamadas por link (estágios 1 e 2), e nenhuma para o que o estágio 0 descarta; **não medida** ainda.
- Custo: OpenAI e Jev cobram por token de entrada; o estágio 0 e o estado enxuto existem para gastar pouco (milhares de vagas de empresas importadas e feeds).
- A extração de perfil é a chamada mais pesada (até 16 000 tokens de saída).
- A formatação OpenAI no radar é opt-in por custo; o default é `false`.

## Testes

- [`ollama.test.ts`](../src/lib/ai/ollama.test.ts): normalização de datas, config exige modo e chave em cloud, header `Authorization` em cloud, `unload` não chama fetch em cloud.
- [`resume-generation.test.ts`](../src/lib/ai/resume-generation.test.ts): seleção de projetos (máx. 2, fallback vazio).
- [`typesafe.test.ts`](../src/lib/ai/typesafe.test.ts): config (fail closed, versão fixa), corpo da requisição, retry em 429/529 com `retry-after`, erros.
- [`generation.test.ts`](../src/lib/ai/generation.test.ts): `GENERATION_ENGINE`, modelos default, cliente OpenAI falso.
- [`triage/*.test.ts`](../src/lib/job-monitoring/triage/): filtros duros, salário, estados, regras, motores (OpenAI/Jev/Ollama com clientes falsos), `triageJob` ponta a ponta e o `triage:eval`.
- Nenhum teste chama um modelo de verdade.
