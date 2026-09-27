# Roadmap e registro de decisões

Datas absolutas. Fontes: histórico do git, specs originais em [`.specs/`](../.specs/) e decisões registradas nas sessões com agentes (ver [memorias-do-agente.md](memorias-do-agente.md)).

## Linha do tempo

| Data | Marco | Commits / refs |
|---|---|---|
| 2026-04-27 | Projeto criado; Next 16; SQLite + shell da fase 1; cliente Ollama para extração de perfil | `21c0e59`, `75b6622`, `a117cb8`, `60b81a3` |
| 2026-04-28 | Ferramenta de comparação de extração OpenAI × Ollama | `e529138` |
| 2026-04-30 | Candidatura passa a exigir empresa (migration `0004`) | `c00edfa` |
| 2026-05-05 | Status `interesting` de candidatura vira `applied` (`0005`) | `5bb0f3c` |
| 2026-05-06 | Runtime Ollama local/cloud configurável; pipeline do radar manual (`0007`); fila de aprovados e modal deep-linkável (`0008`, `0010`) | `c79a344`, `15d6e75`, `32ae4ad` |
| 2026-05-07 | Radar em tempo real via SSE + paralelismo de links (PR #1); run-state e `/api/monitoring/current`; extração de perfil passa para OpenAI; backup com rotação; dedup de leads com skip; TanStack Query nos leads; provider Greenhouse; currículo LaTeX | `73e3442`, `7d09c2c`, `f1d1c71`, `f18817e`, `b3520e2`, `801a6b4`, `3b5187a`, `d7501a9`, `aa9216d`, `17d2b10` |
| 2026-05-08 | Dashboard fase 1; indicação (`0014`); aprovar/descartar otimista; formatação de descrição com IA; projetos pessoais no perfil | `cbdbc03`, `419c17a`, `165e5e1`, `e086015`, `97d5915` |
| 2026-05-11 | Providers InHire e Gupy; primeira rodada de responsividade | `d9fb17f`, `0507f99`, `ff1abc3` |
| 2026-05-13 | Decodificação de entidades HTML do Greenhouse | `b3a8e63` |
| 2026-05-27 | Harness do Claude Code (hooks, MCP, skills) | `7c1d92d`, `5a0cdbc` |
| 2026-09-25 | Preparação para servidor Linux; deploy pull-based + backup diário; fail closed sem banco em produção; app no ar na VPS com dados migrados; todas as telas adaptadas para celular (PR #3) | `b0715d4`, `cc13ca0`, `1a1d311`, `a588281` |
| 2026-09-27 | Redesign monocromático com tema claro/escuro e marca; linguagem visual Notion (PR #4) | `6b3f78b`, `05d892a` |
| 2026-09-27 | Snapshots do Drizzle religados (`db:generate` volta a funcionar); CRUD de empresas na lista, exclusão, logos (`0015`), status manual respeitado, radar em lote pula `discarded`/`blacklist` — branch `feat/companies-crud-logos` | `8db7fd9`, `cb455cc` |

## Decisões

### Produto

- **Ferramenta pessoal, local-first, single-user** (spec original). Sem auth, sem multi-tenant, sem sync.
- **Lead ≠ candidatura** (2026-05-06). O radar gera `job_leads`; só decisão manual promove para `applications`. A spec original dizia "não existe entidade Vaga separada"; a implementação manteve `jobs` + `applications` para reaproveitar o cadastro manual.
- **Descartes automáticos são gravados** (2026-05-07, dedup). Permitem pular a URL nas próximas varreduras; a UI filtra.
- **Classificador prefere `review` a `discarded`** na dúvida: alta cobertura vale mais que precisão.
- **Candidaturas com aprovação humana, sem auto-submit** (2026-09-25). Nada é enviado a empresas sem o usuário.

### IA

- **Ollama como runtime principal**, com modo `cloud` em uso (classificação via HTTP remoto). Configuração explícita obrigatória, sem defaults silenciosos.
- **OpenAI para extração de perfil** (2026-05-07, `f18817e`). O motivo não ficou registrado; hipótese: qualidade da saída estruturada (`json_schema` estrito) em currículos longos, depois da fase de comparação Ollama × OpenAI. Formatação de descrição via OpenAI é opt-in (`OPENAI_FORMAT_JOB_DESCRIPTIONS`, default `false`).

### Engenharia

- **Server Actions em vez de API REST**, Route Handlers só para stream/binário/upload.
- **SSE** para progresso do radar; sem fila nem worker.
- **`pLimit(5)`** por empresa: ~80 % mais rápido em boards grandes (medido em 2026-05).
- **Migrations**: `db:generate` → `db:migrate`. A cadeia de snapshots ficou quebrada desde as migrations `0012`/`0013` (2026-05-07) até `8db7fd9` (2026-09-27); a `0015` foi escrita à mão por isso.

### Infraestrutura (2026-09-25)

- **Oracle Cloud Always Free (A1)** + **Tailscale**: acesso de qualquer lugar via VPN, tudo em free tier. Conta em Pay As You Go (capacidade A1) com alerta de orçamento.
- **Zero porta pública**: `tailscale serve`, Next em `127.0.0.1`, porta 22 fechada, nunca `funnel`.
- **Banco continua SQLite** (o usuário chegou a dizer "MySQL", por engano). VPS vira fonte da verdade.
- **Deploy pull-based com timer systemd, sem GitHub Actions**: nenhuma chave do tailnet/servidor no GitHub.
- **Backup offsite** em outro provedor (R2/B2) com `restic` — pendente.

### Design

- Dark-first; linguagem Notion (neutros quentes, um roxo por tela, tags pastel); tema claro opcional por dispositivo (2026-09-27). Regras normativas em [`DESIGN.md`](../DESIGN.md).

## Roadmap

### Planejado (decidido em 2026-09-25)

1. **Scans agendados** 3×/dia — 09h, 14h, 19h `America/Sao_Paulo` — via timer systemd chamando um endpoint interno protegido por token. Quando existir, a premissa "radar só manual" sai do `CLAUDE.md`.
2. **Digest diário por e-mail** via Resend (proposto às 20h), enviado de um subdomínio de `<DOMINIO_PESSOAL>`. DNS no Registro.br; o apex aponta para a Vercel e não deve ser tocado. Base URL dos links vinda de env do servidor.
3. **Fila de aprovação** para candidaturas (sem auto-submit).
4. **Backup offsite** (restic → B2 ou R2).
5. Usuário: preencher as chaves reais em `/etc/job-tracker/env` (em 2026-09-26 ainda com placeholder).

### Em andamento

- Merge do branch `feat/companies-crud-logos` (CRUD de empresas, logos, filtro de status no radar) na `main`.

### Dívidas técnicas conhecidas

Lista completa em [problemas-conhecidos.md](problemas-conhecidos.md). As que mais pesam:

- migrations não sobem num banco vazio;
- run-state marca `failed` no meio do run (deploy pode reiniciar durante scan);
- 2 testes desatualizados em `index.test.ts`;
- métricas do dashboard enviesadas (qualidade do classificador, currículos gerados).

### Ideias de evolução (README)

- Mais providers e navegação de boards.
- Currículo personalizado mais integrado ao fluxo de candidatura.
- Analytics de diagnóstico do funil.
- Feedback loop do classificador (hoje só 3 promovidos + 3 descartados entram no prompt; leads antigos nunca são reclassificados).
