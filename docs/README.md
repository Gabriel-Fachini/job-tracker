# Documentação do Job Tracker

Documentação técnica do projeto, atualizada em **2026-09-27**. Para a apresentação do produto, veja o [README da raiz](../README.md).

## Leitura sugerida

1. [Visão geral](visao-geral.md) — o que o produto faz, glossário, fluxo ponta a ponta, stack.
2. [Arquitetura](arquitetura.md) — camadas, padrões de dados, providers, estrutura de pastas, segurança, decisões.
3. [Desenvolvimento local](desenvolvimento-local.md) — requisitos, env vars, scripts, banco sintético, armadilhas do ambiente.
4. [Banco de dados](banco-de-dados.md) — schema, enums, migrations (e o que ainda quebra), backup/restore.
5. [Radar de vagas](radar-manual-de-vagas-implementacao.md) — pipeline completo, providers ATS, classificação, SSE, run-state.

## Módulos

- [Leads (triagem)](modulos/leads.md)
- [Candidaturas](modulos/candidaturas.md)
- [Empresas](modulos/empresas.md) (inclui logos)
- [Perfil profissional](modulos/perfil.md)
- [Geração de currículo](modulos/curriculo.md)
- [Dashboard](modulos/dashboard.md)

## Referência

- [Camada de IA](ia.md) — Ollama e OpenAI: onde cada um é usado, configuração, prompts, logs.
- [Route Handlers e Server Actions](referencia-api.md)
- [UI e design system](ui-e-design-system.md) — mapa do código; a norma é o [`DESIGN.md`](../DESIGN.md).
- [Testes e qualidade](testes-e-qualidade.md)

## Operação

- [Deploy e operação](deploy-e-operacao.md) — VPS, Tailscale, deploy pull-based, backups. Runbook: [`deploy/README.md`](../deploy/README.md).
- [Problemas conhecidos e troubleshooting](problemas-conhecidos.md)

## Contexto e histórico

- [Roadmap e decisões](roadmap-e-decisoes.md) — linha do tempo, decisões com data, próximos passos.
- [Memórias do agente](memorias-do-agente.md) — conhecimento acumulado nas sessões com Claude Code.
- [Harness de agentes](harness-de-agentes.md) — hooks, MCP, skills, regras para agentes.
- Documentos da raiz: [`PRODUCT.md`](../PRODUCT.md), [`DESIGN.md`](../DESIGN.md), [`RESPONSIVE_UI_PLAN.md`](../RESPONSIVE_UI_PLAN.md) (plano histórico), [`PROJECTS.md`](../PROJECTS.md) (portfólio para o perfil), [`.specs/`](../.specs/) (spec original).

## Onde está…

| Procuro | Arquivo |
|---|---|
| schema do banco | `src/lib/db/schema.ts` |
| pipeline do radar | `src/lib/job-monitoring/index.ts` |
| prompt do classificador | `src/lib/job-monitoring/classification.ts` |
| adapters ATS | `src/lib/job-monitoring/providers/` |
| cliente SSE do radar | `src/components/leads/monitoring-progress-context.tsx` |
| cliente Ollama | `src/lib/ai/ollama.ts` |
| extração de perfil (OpenAI) | `src/lib/ai/openai.ts` |
| template do currículo | `src/lib/latex/template.tex` |
| métricas do dashboard | `src/server/queries/dashboard.ts` |
| enums e labels | `src/lib/{applications,companies,jobs,job-leads}.ts`, `src/lib/profile/editor.ts` |
| tokens de design | `src/app/globals.css` |
| deploy | `deploy/deploy.sh`, `deploy/systemd/` |

## Convenções desta documentação

- Português brasileiro; nomes de código, comandos e valores de enum como estão no código.
- Links relativos (funcionam no GitHub e no editor).
- *(branch)* marca comportamento commitado num branch que ainda não estava na `main` em 2026-09-27.
- **Hipótese** marca o que foi inferido e não reproduzido.
- Dados sensíveis mascarados (`<TAILNET>`, `<DOMINIO_PESSOAL>`). O repositório é público.
- Ao mudar comportamento documentado, atualize a página correspondente no mesmo commit.
