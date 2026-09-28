# Módulo: Leads (triagem)

Rota `/leads`. Caixa de entrada das vagas que o radar gravou. O usuário aprova, descarta ou promove para candidatura. Como os leads são gerados, ver [radar-manual-de-vagas-implementacao.md](../radar-manual-de-vagas-implementacao.md).

## Arquivos

| Arquivo | Papel |
|---|---|
| [`src/app/(app)/leads/page.tsx`](../../src/app/(app)/leads/page.tsx) | Server Component (`force-dynamic`): query Drizzle + opções de empresa, `<Suspense>` com skeleton |
| [`src/components/leads/leads-client.tsx`](../../src/components/leads/leads-client.tsx) | UI: abas, filtros, lista, modais |
| [`src/components/leads/lead-decisions.ts`](../../src/components/leads/lead-decisions.ts) | hook `useLeadDecisions` (aprovar/descartar otimista) + tom do score |
| [`src/components/leads/lead-detail-modal.tsx`](../../src/components/leads/lead-detail-modal.tsx) | detalhe do lead (sheet) |
| [`src/components/leads/lead-status-badge.tsx`](../../src/components/leads/lead-status-badge.tsx), [`score-meter.tsx`](../../src/components/leads/score-meter.tsx) | tag de classificação e medidor de score |
| [`src/components/leads/monitoring-*.tsx`](../../src/components/leads/) | botão do radar, contexto SSE, painel de progresso |
| [`src/components/leads/types.ts`](../../src/components/leads/types.ts) | `LeadTab`, `LeadListItem` |
| [`src/server/actions/leads.ts`](../../src/server/actions/leads.ts) | `getLeads()` (Server Action usada como `queryFn`) |
| [`src/server/actions/job-monitoring.ts`](../../src/server/actions/job-monitoring.ts) | `approveLead`, `discardLead`, `promoteApprovedLeadToApplication` |
| [`src/lib/job-leads.ts`](../../src/lib/job-leads.ts), [`src/lib/job-leads/mapper.ts`](../../src/lib/job-leads/mapper.ts) | enums/labels e mapeamento linha → `LeadListItem` |

## Dados

`page.tsx` e `getLeads()` fazem a mesma query: `job_leads` ⨝ `companies`, `classification_status ≠ discarded`, ordem `updated_at DESC`. O mapper converte status desconhecido em `review` e decisão desconhecida em `none`.

`LeadListItem`: `id`, `title`, `sourceUrl`, `sourceName`, `sourceKind`, `applyUrl`, `description`, `workModel`, `seniority`, `locationText`, `salaryText`, `classificationStatus`, `classificationScore`, `classificationReason`, `userDecision`, `promotedToApplicationId`, `discoveredAt`, `updatedAt`, `companyId`, `companyName`.

### TanStack Query

```ts
useQuery({
  queryKey: ["leads"],
  queryFn: () => getLeads(),
  initialData: items,   // vindo do Server Component
  staleTime: 30_000,
});
```

- `initialData` (e não `placeholderData`): primeiro render sem loading.
- `staleTime: 30_000`: sem refetch desnecessário durante um scan.
- Não existe `/api/leads`; a `queryFn` é a Server Action.
- Durante o radar SSE, cada `link-done` com decisão ≠ `discarded` invalida `["leads"]`.
- `QueryProvider` (default `staleTime: 30_000`, Devtools escondido abaixo de 768 px) e `<Toaster/>` ficam no layout raiz; `MonitoringProgressProvider` fica no layout `(app)`, dentro do `QueryProvider`. Essa ordem é obrigatória: o contexto do radar usa `useQueryClient()`.

## Estado na URL

Tudo via `useSearchParamsUpdater` ([`src/hooks/use-search-params-updater.ts`](../../src/hooks/use-search-params-updater.ts)), que usa a History API (sem round-trip ao servidor); `push` por padrão, `replace` quando pedido.

| Param | Valores | Escrita |
|---|---|---|
| `tab` | `triage` (default) · `approved` | replace; trocar de aba remove `leadId` |
| `status` | `interesting` · `review` · ausente = todas | replace |
| `companyId` | inteiro | replace |
| `q` | texto | filtro ao vivo (`useDeferredValue`); URL atualizada com debounce de 350 ms (replace) |
| `leadId` | inteiro | abrir = push (também fixa `tab`); fechar = replace. Deep link funciona: o lead é buscado em todos os itens, não só nos filtrados. |

"Limpar filtros" remove `q`, `status`, `companyId` e `leadId`, mantendo `tab`.

## Abas, filtros e lista

- Base: itens com `promotedToApplicationId === null`.
- **Triagem**: `userDecision = none`. **Aprovados**: `userDecision = approved`. Contagens no cabeçalho e nas abas.
- Ordem dos filtros: empresa e busca primeiro; os contadores do toggle de classificação refletem esses filtros; o filtro de status é aplicado por último.
- Busca: substring em título, empresa, motivo, descrição e local, com `toLocaleLowerCase("pt-BR")`. **Não** ignora acentos.
- Sem ordenação manual: vale `updated_at DESC` do servidor.
- Contador "N leads" ou "filtrados/total".
- Estados vazios: sem nenhum lead → link para `/companies`; com filtros ou aba vazia → mensagem específica.

Cada linha: botão que abre o detalhe, link externo para a vaga, e ações — Triagem: **Descartar** e **Aprovar**; Aprovados: **Criar candidatura**. Score com tom: ≥ 80 positivo, ≥ 50 atenção, abaixo disso neutro.

## Ações

### Aprovar / Descartar (otimista)

`useLeadDecisions`:

- **Aprovar**: `setQueryData(["leads"])` marca `approved` → callback opcional (ex.: fechar modal) → `approveLead(id)` → `invalidateQueries(["leads"])` → toast "Lead aprovado".
- **Descartar**: remove do cache → `discardLead(id)` → invalida → toast "Lead descartado".
- Não há rollback nem toast de erro.

No servidor:

- `approveLead` ignora em silêncio lead inexistente, descartado ou já promovido; senão grava `user_decision = approved` e `user_decision_at`.
- `discardLead` grava `classification_status = discarded` **e** `user_decision = dismissed`. Ou seja, sobrescreve o veredito do classificador (isso distorce a métrica de qualidade do dashboard).
- Ambos revalidam `/companies`, `/applications` e `/leads`.
- **Não existe desfazer/restaurar.** Lead descartado some da UI (a query filtra `discarded`).

### Promover para candidatura

1. Na aba Aprovados, "Criar candidatura" abre `ApplicationCreateModal` (com `key` por lead) usando `submitAction = promoteApprovedLeadToApplication`.
2. O modal vem pré-preenchido com os dados do lead, `status = applied` e a nota "Promovida a partir do radar manual de vagas. Motivo: …". O `leadId` vai num input hidden.
3. O servidor exige lead não descartado, `approved` e ainda não promovido; título e descrição obrigatórios; URL válida; `companyId` inteiro.
4. `createApplicationRecord` cria `jobs` + `applications`; o lead recebe `promoted_to_application_id` e `user_decision = promoted`.
5. Revalida `/leads`, `/companies`, `/applications`.
6. Com sucesso, o modal dispara `generateResume` automaticamente (ver [curriculo.md](curriculo.md)).

`source_name` inválido na promoção vira `company_site` (no cadastro manual vira `null`). Um lead `inhire` não tem opção no `<select>` de origem e provavelmente sai como `linkedin`, a primeira opção (**hipótese**).

### Modal de detalhe

Sheet em tela cheia (`sheetSize="full"`), mantém o último lead renderizado durante a animação de fechar.

- Cabeçalho: tag de classificação, score, label da decisão.
- Fatos: Senioridade, Modelo, Local, Faixa salarial, Fonte.
- "Por que o radar marcou assim" (`classification_reason`).
- Descrição com `JobMarkdown`.
- Rodapé: "Abrir vaga"; com `userDecision = none`, **Descartar** e **Aprovar lead**; senão **Criar candidatura** (fecha o sheet e abre o modal de criação).

## Fontes (`/leads/sources`)

Botão "Fontes" no cabeçalho de `/leads` leva a `/leads/sources` (página `force-dynamic`; a leitura semeia as fontes padrão). Lista as cinco fontes com tag Ativa/Desativada, último run, último erro (`Notice`), botão "Rodar" (uma fonte) e o switch de habilitar. O botão principal "Rodar fontes" roda todas as habilitadas fora do SSE. As habilitadas também rodam dentro de "Rodar radar", depois das empresas. Código: [`sources-client.tsx`](../../src/components/leads/sources-client.tsx), [`src/server/actions/sources.ts`](../../src/server/actions/sources.ts).

Leads de agregador mostram no detalhe "Vaga encontrada via <fonte>" com link para a página da fonte (atribuição exigida por Remote OK e Jobicy). A lista de leads usa `leadListColumns` ([`src/lib/job-leads/select.ts`](../../src/lib/job-leads/select.ts)) na página, em `getLeads()` e no snapshot dos eventos SSE.

## Radar a partir de `/leads`

Botão `MonitoringRunButton` com `useStream` (labels "Rodar radar", "Radar" no mobile, "Rodando…"), `showCancel={false}` porque o painel de progresso já oferece Cancelar. Desabilitado enquanto `progress.isRunning` (erro de uma empresa não reabilita; só `all-done` ou o servidor dizer que não há run). Um segundo run é recusado e a aba passa a acompanhar o run existente pelo snapshot. Detalhes do SSE no doc do radar.

## Mobile

- `Dialog` vira bottom sheet arrastável (Drawer do Base UI) abaixo de 640 px.
- Filtros numa linha com scroll horizontal; filtro de empresa é `<select>` nativo transparente a 16 px (evita zoom do iOS).
- Alvos de toque `pointer-coarse:h-10`, lista full-bleed, data escondida no telefone, rodapé do sheet respeita safe area, "Abrir vaga" só com ícone.

## Armadilhas

- Um lead promovido não aparece em nenhuma aba. Um `?leadId=` apontando para ele oferece "Criar candidatura", que o servidor recusa.
- Depois de promover, não há `invalidateQueries(["leads"])` no cliente; a saída da linha de "Aprovados" depende de refetch posterior (revalidação/`staleTime`).
- O link do funil do dashboard para `/leads?status=promoted` não é tratado aqui (cai em "Todas").
- Só leads `promoted` e `dismissed` alimentam o feedback do classificador; `approved` não.
- Sem atalhos de teclado nesta tela (o único atalho global é ⌘/Ctrl+B da sidebar).
