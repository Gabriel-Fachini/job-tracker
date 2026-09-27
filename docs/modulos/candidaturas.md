# Módulo: Candidaturas

Rota `/applications`. Acompanha cada candidatura (um `job` + uma `application`) com status, etapas, notas, currículo usado e currículo gerado.

## Arquivos

| Arquivo | Papel |
|---|---|
| [`src/app/(app)/applications/page.tsx`](../../src/app/(app)/applications/page.tsx) | Server Component (`force-dynamic`): candidaturas ⨝ jobs ⨝ companies (`created_at DESC`) + etapas agrupadas por candidatura |
| [`src/components/applications/applications-client.tsx`](../../src/components/applications/applications-client.tsx) | lista em abas por status, troca de status otimista |
| [`src/components/applications/application-create-modal.tsx`](../../src/components/applications/application-create-modal.tsx) | criação manual e promoção de lead |
| [`src/components/applications/application-detail-modal.tsx`](../../src/components/applications/application-detail-modal.tsx) | detalhe completo (etapas, notas, currículo, descrição, contexto) |
| [`src/components/applications/application-status-select.tsx`](../../src/components/applications/application-status-select.tsx), [`application-status-badge.tsx`](../../src/components/applications/application-status-badge.tsx) | select e tag de status |
| [`src/components/applications/job-markdown.tsx`](../../src/components/applications/job-markdown.tsx) | renderização de markdown das vagas (também usada em leads) |
| [`src/server/actions/applications.ts`](../../src/server/actions/applications.ts) | mutações |
| [`src/lib/applications.ts`](../../src/lib/applications.ts), [`src/lib/jobs.ts`](../../src/lib/jobs.ts) | enums, labels, helpers de data/markdown |

Esta tela **não** usa TanStack Query: os dados chegam por props do Server Component e são atualizados com `router.refresh()` / `revalidatePath`.

## Status

| Valor | Label | Tag |
|---|---|---|
| `applied` | Aplicada | cinza |
| `in_process` | Em processo | azul |
| `offer` | Oferta | roxo |
| `approved` | Aprovada | verde |
| `rejected` | Rejeitada | vermelho |
| `withdrawn` | Desistiu | neutro |

`normalizeApplicationStatus` converte o legado `interesting` e qualquer valor desconhecido em `applied`. O status da candidatura alimenta o status derivado da empresa (ver [banco-de-dados.md](../banco-de-dados.md#companies)).

## Lista

Apesar de nomes como `BoardState`/`moveCard`, **não é kanban** e não há drag and drop:

- Uma aba (`TabBar`) por status, com contagem; lista abaixo.
- Aba inicial: `?status=` válido → primeiro status com itens → `applied`. A aba ativa é rolada para a vista.
- Linha: título, select de status, meta (empresa, modelo, senioridade, origem, data `appliedAt ?? createdAt`).
- Itens novos do servidor são adotados no render, sem remount.

| Param | Uso |
|---|---|
| `status` | aba ativa (replace) |
| `applicationId` | abre o detalhe (push ao abrir, replace ao fechar) |

### Troca de status

Otimista: move o card (vai para o topo do novo status), chama `updateApplicationStatus`; erro → rollback + `toast.error`; sucesso → `toast.success("Movida para …")`.

No servidor (`updateApplicationStatus`):

1. Valida id e status; status igual ao atual → no-op.
2. Na transação: atualiza `status`/`updated_at` (e `applied_at` na primeira ida para `applied`) e insere em `application_status_history`.
3. `syncCompanyStatusForApplication` recalcula o status da empresa.
4. Revalida `/applications` e `/companies`.

O select de status para a propagação do clique (ele fica dentro de uma linha clicável).

## Criar candidatura (manual)

`ApplicationCreateModal` com `createApplication`:

| Campo | Regra |
|---|---|
| Título | obrigatório |
| Empresa | obrigatório (`<select>` nativo; sem empresas cadastradas o modal mostra aviso e link para `/companies/new`, e o submit fica desabilitado) |
| Descrição (markdown) | obrigatória; botão **Formatar** usa IA |
| Status | default `applied` |
| Modelo de trabalho, Senioridade | opcionais (enums de [`src/lib/jobs.ts`](../../src/lib/jobs.ts)) |
| Origem | default `other` (`linkedin`, `gupy`, `catho`, `company_site`, `other`) |
| URL original | `type=url`; o servidor exige `new URL()` válido |
| Notas | opcional |

Validação no servidor: título, descrição, URL parseável, `companyId` inteiro e existente. Qualquer falha devolve `{ success: false, error: "validation" }` e a UI mostra um aviso genérico.

Com sucesso: campos travam, aviso de sucesso, e o modal chama **`generateResume` automaticamente** (spinner → "Abrir PDF" ou erro). O rodapé vira "Fechar".

`createApplicationRecord` grava `jobs.status = applied` e a candidatura **sem `applied_at`** (a lista cai em `created_at`).

"Formatar" chama `formatApplicationDescriptionWithAi` → `formatJobDescriptionWithOllama` (**Ollama**, `temperature 0.1`). O radar usa OpenAI para a mesma tarefa. Ver [ia.md](../ia.md).

## Detalhe

Sheet em tela cheia, até `max-w-5xl` no desktop.

- **Cabeçalho**: select de status, selo "Indicação" (se `is_referral`), título e empresa.
- **Etapa atual**: última etapa, tempo "Na etapa" e aviso de saúde (≤ 14 dias positivo, ≤ 30 atenção, acima negativo).
- **Etapas**: formulário (label, data — default hoje —, notas) → `createApplicationStage`. Timeline do mais novo para o mais antigo, com a duração de cada etapa. Edição inline (`updateApplicationStage`) e exclusão com `window.confirm` (`deleteApplicationStage`). Datas gravadas ao meio-dia local (`T12:00:00`) para não mudar de dia com fuso.
- **Notas**: Salvar/Descartar aparecem só com alteração → `updateApplicationNotes`.
- **Currículo** (`UsedResumeSection`):
  - Currículo usado: `unknown` · `uploaded` · `empty`. "Enviar PDF" faz `POST /api/applications/{id}/resume` (FormData `file`); "Sem currículo" e "Desfazer" mandam `mode=empty` / `mode=unknown`.
  - Currículo gerado por IA: "Gerar currículo" / "Gerar novamente" / "Tentar novamente" → `generateResume`; "Abrir PDF" → `GET /api/applications/{id}/generated-resume`; preview em iframe a partir de `sm`.
- **Descrição da vaga**: visualização com `JobMarkdown`; edição com "Formatar com IA"; salvar (desabilitado sem mudança) → `updateApplicationDescription` (grava em `jobs.description`).
- **Contexto da vaga** (aside, sticky a partir de `lg`): id, empresa, datas, origem, modelo, senioridade, indicação. Modo edição → `updateJobContext` (campos de `jobs` + `applications.is_referral`).
- **Rodapé**: "Abrir vaga original"; "Fechar" some no telefone quando o link existe.

Os editores usam `key` com `updatedAt` + conteúdo: depois de um `router.refresh()`, o estado local reinicia com o valor salvo.

Não aparecem na UI: `recruiter_name`, `recruiter_contact`, `tracking_channel` (só no schema) e o histórico de status (gravado, nunca exibido). O `GET /api/applications/{id}/resume` existe, mas nenhum link aponta para ele.

## Upload do currículo usado

`saveApplicationResume` ([`src/lib/applications/resume-upload.ts`](../../src/lib/applications/resume-upload.ts)):

- Arquivo não vazio, até 10 MB, extensão `.pdf` **ou** `type = application/pdf`.
- Salvo em `<UPLOADS_PATH>/resumes/applications/application-<id>-resume-<timestamp>.pdf`.
- Banco guarda caminho **relativo ao `cwd`** (`path.relative(process.cwd(), …)`) e o nome original.

## Markdown (`JobMarkdown`)

- `react-markdown` + `remark-gfm`, **sem** plugins rehype: HTML cru não é renderizado.
- Estilos próprios para títulos, listas, links (`break-all`, sem `target`), código, tabelas (wrapper com scroll horizontal) e citações. 15 px no telefone, 14 px a partir de `sm`.
- `normalizeMarkdown` remove BOM, converte CRLF, tira indentação comum (fora de blocos de código) e faz trim.

## Armadilhas

- Cancelar/Fechar do modal de criação chamam `onOpenChange(false)` direto, sem o `resetModalState`; em `/applications` o modal não tem `key`, então o estado "criada" pode persistir ao reabrir (não verificado em runtime).
- Fallback de `source_name` diverge: inválido vira `null` no cadastro manual e `company_site` na promoção; o default da UI é `other`.
- Não há exclusão de candidatura.
