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

"Formatar" chama `formatApplicationDescriptionWithAi` → `formatJobDescription`, que usa o motor de geração (`GENERATION_ENGINE`: OpenAI `gpt-6-sol` por padrão, Ollama como fallback). Ver [ia.md](../ia.md).

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

## Candidatura assistida (kit)

Rota `/applications/[id]/kit` (link no detalhe da candidatura e no modal de promoção de lead do radar internacional). **O app nunca envia candidatura**: prepara tudo e o usuário envia.

| Arquivo | Papel |
|---|---|
| [`src/lib/apply/kit.ts`](../../src/lib/apply/kit.ts) | `prepareApplicationKit`: orquestra as partes; cada uma falha sozinha e vira aviso |
| [`src/lib/apply/form-sources.ts`](../../src/lib/apply/form-sources.ts), [`form-extract.ts`](../../src/lib/apply/form-extract.ts) | campos do formulário: Greenhouse pela API pública (`?questions=true`), Lever pelo HTML de `/apply`, demais por Playwright headless (só leitura; login/CAPTCHA → campos desconhecidos) |
| [`src/lib/apply/field-mapping.ts`](../../src/lib/apply/field-mapping.ts), [`field-mapping-model.ts`](../../src/lib/apply/field-mapping-model.ts) | campo → chave de resposta: heurística primeiro; o resto pelo motor da triagem (`TRIAGE_ENGINE`), enviando só rótulos e opções. Confiança baixa → `unknown` |
| [`src/lib/apply/answers.ts`](../../src/lib/apply/answers.ts) | respostas vindas do perfil e de `search_preferences.default_answers`. Pergunta demográfica (EEO) **nunca** é respondida |
| [`src/lib/apply/cover-letter.ts`](../../src/lib/apply/cover-letter.ts) | cover letter (120–180 palavras, inglês) e rascunhos de respostas abertas (até 5, marcados "rascunho IA"), pelo motor de geração |
| [`src/lib/apply/kit-store.ts`](../../src/lib/apply/kit-store.ts), tabela `application_kits` | persistência; status `draft` → `ready` → `submitted_by_user` |
| [`src/server/actions/kit.ts`](../../src/server/actions/kit.ts) | preparar/refazer, editar resposta, editar cover letter, "Marquei como enviada" (move para `applied` pelo fluxo normal de status) |
| [`src/components/applications/kit-client.tsx`](../../src/components/applications/kit-client.tsx) | UI: respostas com copiar/editar, download do currículo em inglês, cover letter, "Abrir formulário" |
| `GET /api/applications/[id]/kit`, `…/kit/resume` | JSON do kit e PDF, usados pelo script local |
| [`scripts/apply-fill.ts`](../../scripts/apply-fill.ts) + [`fill-plan.ts`](../../src/lib/apply/fill-plan.ts) | `npm run apply:fill -- --app-url <url> --application <id>` |

O currículo do kit sai em inglês (`generateResume(id, { language: "en" })`, ver [curriculo.md](curriculo.md)); o fluxo pt-BR segue igual.

### Preenchimento local (`apply:fill`)

Roda **no computador do usuário** (a VPS não tem display): Chromium visível, perfil persistente em `tmp/apply-profile` (logins feitos à mão ficam salvos), preenche os campos mapeados, anexa o currículo, destaca em laranja o que ficou para o usuário (desconhecidos, EEO, cover letter em arquivo) e **para**. Não clica, não aperta Enter e não envia; um teste proíbe `click`/`press`/`submit`/`dispatchEvent` no código do script (`FORBIDDEN_SCRIPT_CALLS`). Página com login ou CAPTCHA: não preenche nada e avisa no terminal. O `--app-url` precisa alcançar o app (na produção, pela tailnet).

## Upload do currículo usado

`saveApplicationResume` ([`src/lib/applications/resume-upload.ts`](../../src/lib/applications/resume-upload.ts)):

- Arquivo não vazio e até 10 MB. A checagem de tipo não barra nada: `getPdfExtension` sempre devolve `.pdf`, então qualquer arquivo passa e é salvo como `.pdf`.
- Salvo em `<UPLOADS_PATH>/resumes/applications/application-<id>-resume-<timestamp>.pdf`.
- Banco guarda caminho **relativo ao `cwd`** (`path.relative(process.cwd(), …)`) e o nome original.

## Markdown (`JobMarkdown`)

- `react-markdown` + `remark-gfm`, **sem** plugins rehype: HTML cru não é renderizado.
- Estilos próprios para títulos, listas, links (`break-all`, sem `target`), código, tabelas (wrapper com scroll horizontal) e citações. 15 px no telefone, 14 px a partir de `sm`.
- `normalizeMarkdown` remove BOM, converte CRLF, tira a indentação comum (o mínimo ignora só linhas de cerca sem indentação, mas o recuo é removido de todas as linhas, inclusive dentro de blocos de código) e faz trim.

## Armadilhas

- Cancelar/Fechar do modal de criação chamam `onOpenChange(false)` direto, sem o `resetModalState`; em `/applications` o modal não tem `key`, então o estado "criada" pode persistir ao reabrir (não verificado em runtime).
- Fallback de `source_name` diverge: inválido vira `null` no cadastro manual e `company_site` na promoção; o default da UI é `other`. Lead com `inhire` (sem opção no `<select>`) provavelmente é promovido como `linkedin`, a primeira opção (**hipótese**).
- Depois que existe currículo gerado (o normal, já que ele é gerado ao criar/promover), "Enviar PDF" e "Sem currículo" somem para o status `unknown`; um PDF enviado não tem troca nem desfazer.
- Não há exclusão de candidatura.
