# Camada de IA

Dois provedores, cada um com papel definido:

- **Ollama** (local ou Ollama Cloud): classificação de leads, seleção de conteúdo do currículo, formatação de descrição a pedido do usuário.
- **OpenAI**: extração do perfil a partir do PDF (obrigatório para esse fluxo) e, opcionalmente, formatação de descrições no radar.

Código em [`src/lib/ai/`](../src/lib/ai/).

## Onde cada modelo é usado

| Tarefa | Provedor | Função | Modelo | Parâmetros |
|---|---|---|---|---|
| Classificar lead do radar | Ollama | `classifyJobLead` → `callOllamaLlm` | `OLLAMA_MODEL` | `format` = JSON Schema, `temperature 0`, `think: false` |
| Selecionar bullets/skills do currículo | Ollama | `generateResumeSelection` | `OLLAMA_MODEL` | `format: "json"`, `temperature 0` |
| Botão "Formatar" na candidatura | Ollama | `formatJobDescriptionWithOllama` | `OLLAMA_MODEL` | `temperature 0.1`, `think: false` |
| Extrair perfil do currículo | OpenAI | `extractProfileWithOpenAi` | `OPENAI_COMPARISON_MODEL` (default `gpt-5.4`) | Responses API, `json_schema` estrito, `max_output_tokens 16000` |
| Formatar descrição no radar (opt-in) | OpenAI | `formatJobDescriptionAsMarkdown` | `gpt-4o-mini` (fixo) | `max_output_tokens 4000`; só com `OPENAI_FORMAT_JOB_DESCRIPTIONS=true` |
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

- `getOpenAiComparisonConfig()` exige `OPENAI_API_KEY` (senão `OpenAiComparisonConfigurationError`) e lê `OPENAI_COMPARISON_MODEL` (default `gpt-5.4`). Atenção: variável definida porém vazia vira modelo `""`.
- `extractProfileWithOpenAi(rawText)`: prompt de sistema em pt-BR ("seja exaustivo, não invente, preserve bullets, trate educação com a mesma atenção"), schema `profile_extraction` estrito. `incomplete_details` (ex.: limite de tokens) vira erro explicativo.
- `formatJobDescriptionAsMarkdown(text)`: pede `##` por seção, listas com `-`, **negrito** em tecnologias, sem inventar nem parafrasear, no idioma original.

## Prompts do classificador (resumo)

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

- Referência medida em 2026-05: ~2 s por link no radar (extração + classificação), ~20 s para 50 links com `pLimit(5)`.
- A extração de perfil é a chamada mais pesada (até 16 000 tokens de saída).
- A formatação OpenAI no radar é opt-in por custo; o default é `false`.

## Testes

- [`ollama.test.ts`](../src/lib/ai/ollama.test.ts): normalização de datas, config exige modo e chave em cloud, header `Authorization` em cloud, `unload` não chama fetch em cloud.
- [`resume-generation.test.ts`](../src/lib/ai/resume-generation.test.ts): seleção de projetos (máx. 2, fallback vazio).
- Nenhum teste chama um modelo de verdade.
