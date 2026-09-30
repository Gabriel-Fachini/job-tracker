# Problemas conhecidos e armadilhas

Levantamento feito em 2026-09-27 lendo o código (e, quando indicado, testando). Itens marcados como **hipótese** não foram reproduzidos. Referências `arquivo:linha` valem para essa data.

## Radar e SSE

> **Corrigido em 2026-09-27** (tracker do run + `runBulkMonitoring`): erro de uma empresa não encerra mais o run nem reabilita o botão; o deploy espera o run inteiro; segundo run SSE é recusado (`already-running`); snapshot mostra progresso e erros por empresa; run travado vira `stale` após 15 min; fechar o stream cancela o run no servidor; aba recarregada acompanha pelo snapshot; contadores ao vivo batem com o resumo. Detalhes em [radar-manual-de-vagas-implementacao.md](radar-manual-de-vagas-implementacao.md#streaming-sse).

- **Runs de `/companies` e `/companies/[id]` ficam fora do tracker**: não aparecem no snapshot, não são barrados pela trava e o deploy não espera por eles. O resultado da action também é descartado pelo botão (nenhum toast, nem o erro "Empresa fora do radar monitoravel.").
- **Fechar, recarregar ou suspender a aba cancela o run** (no celular, o sistema suspende abas em segundo plano). Links já em andamento terminam e gravam; a lista só mostra esses leads no próximo refetch.
- **Aba que só acompanhou pelo snapshot** mostra no resumo final os números da última leitura, não o total.
- **Motor de triagem padrão mudou para OpenAI** (revisão de 2026-09-28): a VPS precisa de `OPENAI_API_KEY` no `/etc/job-tracker/env` (já existe para a extração de perfil) e, opcionalmente, `OPENAI_TRIAGE_MODEL`. Sem a chave, o radar falha na largada com mensagem clara em vez de gravar leads sem triagem. `TRIAGE_ENGINE=ollama` volta ao Ollama (mesmo contrato, outro modelo).
- **Confiança do motor OpenAI/Ollama é auto-relato** (`low/medium/high` → 0,4/0,7/0,9), não calibrada como a da Jev; os limiares (0,8 para descartar por elegibilidade/contrato/senioridade/família, 0,6 para forçar `review`) foram escolhidos para a Jev e pedem ajuste com `npm run triage:eval`. Na prática, com OpenAI só `high` descarta.
- **Cliente Jev nunca foi exercitado contra a API real** (sem chave); o formato vem da documentação (`/api.md`) e a suíte usa `fetch` falso. Confira a primeira resposta real (`model`/`usage` nos logs `[triage] [jev]`).
- **Triagem faz até 2 chamadas de modelo por vaga** e nenhuma para o que o estágio 0 descarta. Com centenas de empresas importadas e sem preferências salvas (filtros desligados), um run pode ser caro e lento: salve as preferências antes de habilitar muitas empresas.
- **"Elegibilidade não informada" limita o lead a `review`**: muitas vagas dizem só "Remote" (decisão conservadora); a fila de revisão cresce.
- **Fontes agregadas rodando duas vezes ao mesmo tempo** (o botão "Rodar fontes" de `/leads/sources` ou `runSourcesMonitoring` durante um run SSE): não passam pelo tracker; a segunda corrida pode bater no índice único `(company_id, source_url)` e contar a vaga como falha. Evite rodar as duas coisas juntas.
- **Fontes agregadas dependem de feeds públicos sem contrato**: formato, limites e termos podem mudar; Himalayas só entrega 20 vagas por página (a primeira corrida lê até `maxPages` = 15, ~300 vagas); o feed do Remote OK tem ~100 vagas; HN não filtra por localização além de "remote".
- **`dedup_key` não existe em leads anteriores à migration `0018_international_radar`**: uma vaga que já estava no banco pode reaparecer via agregador uma vez (URL diferente, sem chave para comparar).
- **Sink de descartados**: leads descartados de fontes agregadas ficam sob a empresa `Vagas descartadas (agregadores)`; se ela for excluída manualmente (está escondida da lista, só via banco), o próximo run a recria, mas os leads antigos somem junto (FK) e as vagas voltam a ser processadas.
- **Varredura individual ignora status**: desde `cb455cc` a varredura em lote pula `discarded`/`blacklist`, mas `runCompanyMonitoring` (detalhe da empresa) varre qualquer status. Intencional segundo o código; vale lembrar ao ler leads de empresas descartadas.
- **`ats_board_token` sem uso**: sem campo na UI, só repassado; nenhum provider lê.
- **Leads nunca são reclassificados**: URL já conhecida é pulada, mesmo após mudar o perfil ou o prompt.
- **`sourceName` incompleto**: `inhire` não existe em `sourceNameOptions` (Ashby, Lever e Greenhouse existem desde `feat/radar-internacional`); no modal de promoção o `<select>` provavelmente cai na primeira opção (`linkedin`) — **hipótese**, não testado.
- **`GET` que dispara scan com `Access-Control-Allow-Origin: *`** e sem auth. Mitigado pela rede (só tailnet), mas qualquer página aberta num dispositivo do tailnet poderia iniciar um run.
- **Listagem Gupy/InHire fora do ar parece board vazio**: os adapters devolvem `[]` sem lançar, sem fallback HTML; o log diz `provider-discovery-success` com 0 links.

## Banco e migrations

- **Banco vazio não migra** (testado): `0007` tem statement vazio no fim; `0013_tough_living_lightning` copia `last_viewed` de uma tabela que ainda não o tem; `0013_outgoing_princess_powerful` repete `ADD COLUMN` de `0012`. O `drizzle-kit migrate` desfaz tudo e sai sem mensagem. Contorno: criar banco a partir de `.schema` ([banco-de-dados.md](banco-de-dados.md#banco-novo-vazio-não-migra)). Correção já foi sugerida como tarefa separada numa sessão anterior.
- **`db:generate` estava quebrado** até `8db7fd9` (snapshots `0012`/`0013` com o mesmo `prevId`). Corrigido; `drizzle-kit check` passa.
- **Migration órfã** `0000_typical_joshua_kane.sql` (fora do journal).
- **WAL**: documentação antiga dizia WAL; o código não configura e o banco local está em `journal_mode=delete`.
- **Tabela `resumes` e colunas sem uso**: `resumes`, `applications.recruiter_name|recruiter_contact|tracking_channel`, `jobs.status`.
- **Caminhos de arquivo inconsistentes**: uploads gravados relativos ao `cwd`, currículo gerado absoluto. Mudar `cwd`/diretório de dados quebra a leitura.

## Dashboard

- Match de preferências lê `profile` com `LIMIT 1` sem ordenação (não o perfil mais recente); inofensivo com um perfil só.
- "Currículos gerados" lê `resumes` → sempre 0.
- Qualidade do classificador enviesada: `discardLead` sobrescreve `classification_status`; descartes automáticos nunca chegam à UI.
- Timeline não mostra dias zerados (sem preenchimento de datas; agrupamento em UTC).
- `c.status != 'archived'` (`src/server/queries/dashboard.ts:353`) não filtra nada.
- Link do funil para `/leads?status=promoted` não é tratado pela tela de leads.
- Aviso do backlog diz "interessante(s)" mas conta `review` também.
- `src/components/dashboard/chart-widgets.tsx` não é importado.
- Um React #418 (texto diferente entre servidor e cliente na hidratação) apareceu uma vez no preview de 2026-09-29, logo após subir o servidor (primeira carga do `/dashboard` ou do `/profile`); recargas seguintes das mesmas páginas não repetiram. Não reproduzido; suspeita de texto dependente da hora. Para investigar, rodar em modo dev, que mostra o texto divergente.
- Painel "Radar internacional": "Elegíveis" conta toda vaga sem `location_ineligible` (inclusive `not_stated` e descartes por salário), e a mediana salarial usa o ponto médio da faixa dessas vagas.

## Leads

- Descartar é irreversível pela UI e apaga o veredito original do classificador.
- Após promover, o cache `["leads"]` não é invalidado no cliente.
- `?leadId=` de lead promovido oferece "Criar candidatura", que o servidor recusa.
- Busca não ignora acentos.
- Updates otimistas sem rollback nem toast de erro.

## Candidaturas

- **Checagem de tipo de PDF não barra nada** (também no upload do perfil): `getPdfExtension` sempre devolve `.pdf`, então qualquer arquivo de até 10 MB é aceito e salvo como `.pdf`.
- Com currículo gerado, "Enviar PDF" e "Sem currículo" somem para o status `unknown`; um PDF enviado não tem troca nem desfazer.
- `generateResume` compila com `execFileSync` (até 60 s): bloqueia o event loop do Node, inclusive o SSE do radar.
- `applied_at` fica `null` na criação (mesmo com status `applied`).
- **Hipótese**: estado "criada" do modal de criação pode persistir ao reabrir em `/applications` (Cancelar/Fechar não passam pelo reset; modal sem `key`).
- Fallback de `source_name` diverge entre cadastro manual (`null`), promoção (`company_site`) e UI (`other`).
- Histórico de status gravado e nunca exibido; `GET /api/applications/[id]/resume` sem link na UI.

## Empresas

- **Importação YC** (`companies:import-yc`) cria centenas de empresas de uma vez; a descoberta de ATS por slug pode aceitar um homônimo (`via: "slug"`). Confira `jobs_board_url` das empresas importadas antes de confiar nos leads. Sem ATS, a empresa fica com radar desligado e só aparece pelas fontes agregadas.
- Logos automáticos só rodam para empresas `manual`; importadas/agregadas ficam com iniciais.
- `GET /api/companies/[id]/logo` tem efeito colateral: busca o site, grava arquivo em `<UPLOADS_PATH>/logos` e atualiza a empresa.
- Rejeição de ícone < 16 px só vale para PNG, GIF e ICO.
- Erro `linked-applications` bloqueia por qualquer `jobs` ligado, não só candidaturas.
- Criação via form action perde o que foi digitado quando o servidor rejeita.
- Ramo de "job antigo sem `company_id`" em `company-links.ts` provavelmente morto (`company_id` é `NOT NULL`).

## Perfil e IA

- Estado vazio fala em "extração local"; a extração é OpenAI.
- Aviso de sucesso do upload nunca aparece (diálogo fecha antes).
- `profile-review-form.tsx` morto.
- `OPENAI_COMPARISON_MODEL` definida e vazia vira modelo `""`.
- `compareProfileExtraction` sem chamador (e `extractProfileFromText` só é chamado por ele).
- PDFs master antigos nunca apagados; `tmp/logs/` guarda perfil e texto do currículo.
- Valores fixos no currículo: nome no arquivo, idiomas, "Brasil" na formação.

## Infra e ferramentas

- `tectonic` não é instalado pelo `install.sh`.
- `pdfjs-dist` só existe como dependência transitiva de uma devDependency (`pdf-parse`).
- Chaves de produção com placeholder em 2026-09-26 (pendência do usuário).
- Backups da VPS no mesmo disco; offsite pendente.
- Rollback automático do deploy não desfaz migrations: a release anterior volta sobre o banco já migrado.
- `npm run resume:sample` ignora `UPLOADS_PATH` (grava sempre em `uploads/resumes/generated/__sample__`).
- Hook `SessionEnd` roda `pkill -f "next dev"` (qualquer projeto na máquina) e mata o processo em `:3000`, inclusive o servidor do usuário.
- Hook `post-edit-typecheck.sh` usa `timeout`, que não existe no macOS sem coreutils: o `tsc` nunca roda e o hook fica mudo.
- Scripts `test:profile-extraction` e `analyze:profile-extractions` apontam para arquivos inexistentes em `tmp/` (mantidos por decisão do usuário; também citados no `README.en.md`).
- `npm run test:job-monitoring` usa o `DATABASE_URL` do ambiente; sem ele, os testes do radar consultam o `./job-tracker.db` real. Use `npm test`.
- 2 testes desatualizados em `src/lib/job-monitoring/index.test.ts`.

## Documentação

- `AGENTS.md` (no git: `agents.md`) defasado em relação ao `CLAUDE.md` e, no working tree, termina com um cabeçalho vazio "Imported Claude Cowork project instructions".
- [`RESPONSIVE_UI_PLAN.md`](../RESPONSIVE_UI_PLAN.md) fala em tema "dark-only" (superado pelo tema claro).
- [`.specs/`](../.specs/) descreve o plano original (ex.: `compiler.ts` do LaTeX, "sem entidade Vaga"); use como histórico, não como estado atual.

## Troubleshooting rápido

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `drizzle-kit migrate` sai com exit 1 sem mensagem | coluna já existe / statement vazio | comparar `sqlite3 <db> .schema` com o SQL pendente; ver incidente em [banco-de-dados.md](banco-de-dados.md) |
| Mudança em `globals.css` não aparece | cache do Turbopack | parar servidor, `rm -rf .next`, subir; conferir com `getComputedStyle` |
| Radar termina com 0 links numa empresa | board dinâmico / heurística | trocar para `browser`; checar `fetch-page-result` no log; testar provider ATS |
| Todas as vagas caem em `failed` | Ollama mal configurado / timeout | conferir `OLLAMA_*`; log `classification-failed` |
| Leads em `review` com score 40 | sem perfil salvo | subir o currículo em `/profile` |
| Upload de perfil falha | `OPENAI_API_KEY` ausente, PDF sem texto (escaneado) ou > 10 MB | mensagem de erro no diálogo; `tmp/logs/profile-extraction-error-*.json` |
| "Falha ao gerar currículo" | `tectonic` ausente, vaga sem descrição, JSON inválido do Ollama | instalar `tectonic`; preencher descrição; ver stdout |
| App de produção não sobe após deploy | health check falhou → rollback automático | `journalctl -u job-tracker-deploy -n 100` |
| Deploy "ABORTED" | `DATABASE_URL` relativo ou arquivo ausente | corrigir `/etc/job-tracker/env`; o próximo tick segue sozinho |
| Screenshot do browser pane preto/cortado | viewport maior que o painel | presets `desktop` ou `mobile` |
