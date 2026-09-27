# Módulo: Dashboard

Rota `/dashboard` (a raiz `/` redireciona para cá). Painel analítico somente leitura sobre o funil: descoberta de leads, triagem, candidaturas e qualidade do classificador.

## Arquivos

| Arquivo | Papel |
|---|---|
| [`src/app/(app)/dashboard/page.tsx`](../../src/app/(app)/dashboard/page.tsx) | Server Component: período, queries, grid de widgets |
| [`src/server/queries/dashboard.ts`](../../src/server/queries/dashboard.ts) | todas as métricas (SQL via Drizzle/`sql`) |
| [`src/components/dashboard/*`](../../src/components/dashboard/) | widgets; `dashboard-widget.tsx` é a moldura comum |

## Período

- Param `range`: `30d` (default) · `90d` · `all`. Valor inválido vira `30d`.
- `resolvePeriod` monta a janela de N dias até agora e uma janela anterior do mesmo tamanho para os deltas dos KPIs. `all` começa na época Unix e não tem janela anterior.
- `PeriodFilter` (client): `SegmentedControl` "30d / 90d / Tudo", `router.push` preservando outros params, dentro de `<Suspense>`.
- Botão de atualizar (form GET), escondido no telefone (lá existe pull-to-refresh).

As queries são síncronas (`better-sqlite3`); o `Promise.all` da página não as paraleliza de fato.

## Widgets

| Widget | Período? | O que mede |
|---|---|---|
| **KPIs** (`kpi-strip.tsx`) | sim | "Leads descobertos" (`discovered_at` no período, sem `discarded`), "Leads revisados" (`user_decision_at` no período), "Candidaturas" (`applications.created_at`), "Currículos gerados" (linhas em `resumes`). Delta: vazio sem base, "+∞" se a base é 0, senão % arredondado. |
| **Backlog de leads** (`backlog-widget.tsx`) | não | Pendentes = `user_decision = none` e não descartados. Total, idade do mais antigo, faixas < 24 h, 1–3 d, 3–7 d, > 7 d. Aviso se houver > 7 d. Link "Ver leads". |
| **Distribuição de classificação** (`classification-widget.tsx`, recharts) | sim | Barra empilhada `interesting` / `discarded` / `review` (ordem escolhida para protanopia) + histograma de score em faixas de 10 (divisão inteira no SQLite; score 100 cai em "100-109"). Alertas só com > 5 leads: descartados > 70 % (negativo), revisar > 50 % (atenção). |
| **Funil de topo** (`funnel-widget.tsx`) | sim | Descobertos (não descartados) → classificados `interesting` → promovidos (`promoted_to_application_id`) → candidaturas criadas no período. Barras relativas aos descobertos; % sobre a etapa anterior. Aviso se promovidos/interessantes < 0,5. |
| **Match de preferências** (`work-model-widget.tsx`) | sim | Leads não descartados por `work_model` (inclui nulos) contra `profile.work_model_preference`. Aviso quando o modelo mais comum difere da preferência (com ≥ 3 leads de modelo conhecido). |
| **Qualidade do classificador** (`classifier-quality-widget.tsx`) | não ("Todo o período") | Leads com `user_decision ≠ none`, cruzando `classification_status × user_decision`. Positivo = `promoted` ou `approved`. Interessante: precisão; Revisar: taxa positiva; Descartado: taxa de falso negativo. Exige ≥ 10 decisões. Precisão < 0,5 → negativo; FN > 0,1 → atenção. |
| **Top empresas** (`top-companies-widget.tsx`) | sim | Empresas com leads não descartados no período (top 20): % interessante, score médio, candidaturas no período. Sinais: "pausar" (≥ 5 leads e 0 % interessante), "priorizar" (≥ 3 leads e ≥ 50 %). Colunas extras só com largura (container queries). Nome → `/leads?companyId=`. |
| **Atividade do radar** (`radar-timeline-widget.tsx`, recharts) | sim | Linha diária: total (inclui descartados) e interessantes, agrupando `strftime(datetime(discovered_at,'unixepoch'))` (UTC). |

Moldura comum (`DashboardWidget`): título, ação opcional, e "Dados insuficientes" quando a amostra fica abaixo de `minSamples` (default 1). Gráficos compartilham `chartTick` e `ChartTooltip`, usam `ResponsiveContainer debounce={50}` e animações desligadas.

Layout: faixa de KPIs (2 colunas no telefone, 4 a partir de `lg`) e grid de widgets (1 coluna abaixo de `lg`, 2 acima). As linhas finas entre widgets são o `gap` de 1 px sobre a cor de borda.

## Armadilhas nas métricas

- **Currículos gerados é sempre 0**: lê a tabela legada `resumes`, que nada grava. A geração atual usa `applications.generated_resume_path`.
- **Qualidade do classificador enviesada**: `discardLead` sobrescreve `classification_status` para `discarded`, então um lead "interessante" descartado pelo usuário cai na linha "Descartado"; descartes automáticos nunca chegam à UI e `approveLead` os recusa. Na prática Interessante/Revisar tendem a 100 % e o falso negativo a 0 %. Pelo mesmo motivo, contagens passadas de "descobertos" encolhem conforme o usuário descarta.
- **Dias sem lead não aparecem** na timeline (sem preenchimento de datas), então o alerta de dia zerado não dispara.
- **Filtro `status != 'archived'`** em Top empresas não tem efeito: `archived` não é status de empresa.
- **Funil → `/leads?status=promoted`**: a tela de leads não trata esse valor (mostra "Todas") e leads promovidos não aparecem em nenhuma aba. "Promovidos" pode incluir leads `review`, então a % sobre "interessantes" pode passar de 100 %.
- O aviso do backlog fala em "interessante(s)", mas conta `interesting` + `review`.
- Tratamento de descartados é misto: distribuição e timeline incluem; KPIs, funil, match e top empresas excluem.
- `chart-widgets.tsx` tem wrappers `next/dynamic` (`ssr: false`) que ninguém importa.
