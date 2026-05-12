# Plano de Responsividade Mobile - Job Tracker

## Objetivo

Tornar o Job Tracker usável em celular sem perder a densidade operacional da versão desktop. O foco principal é permitir navegação mobile, evitar overflow horizontal acidental, tornar ações e formulários confortáveis ao toque, e adaptar superfícies complexas como Kanban, modais, cards, tabelas e dashboards.

Este plano é direcionado para um agente de IA implementar as mudanças. Antes de editar, leia `AGENTS.md`, respeite a regra de não iniciar `npm run dev`, e valide contra o servidor já mantido pelo usuário na porta 3000. Se `http://localhost:3000` não responder, peça ao usuário para iniciar o servidor.

## Contexto técnico

- Stack: Next.js App Router, TypeScript, Tailwind CSS v4, shadcn/Base UI, SQLite/Drizzle.
- Tema: dark-only. Não criar toggle de tema.
- Navegação: `src/components/ui/sidebar.tsx` já tem suporte mobile via `Sheet`, mas hoje o gatilho de abertura fica dentro da própria sidebar em `src/components/app-sidebar.tsx`, então no viewport mobile o usuário não consegue abrir a navegação quando ela está fechada.
- Layout global: `src/app/(app)/layout.tsx` aplica `p-8` já no menor breakpoint, o que consome área útil demais em telas pequenas.
- UI atual mistura boas bases responsivas com alguns pontos frágeis: grids fixos, ações sem `w-full` em mobile, modais centralizados, tabelas densas e Kanban horizontal/drag-first.

## Princípios de implementação

1. Corrigir a responsividade no shell primeiro. Todas as telas dependem disso.
2. Manter a experiência desktop atual quando ela já funciona.
3. Em mobile, priorizar fluxos verticais, ações com largura total e alvos de toque de pelo menos `44px`.
4. Evitar esconder funcionalidades no mobile. Quando a interação desktop for impraticável, oferecer alternativa mobile equivalente.
5. Corrigir overflow na causa local. Não usar `overflow-x-hidden` para mascarar conteúdo essencial.
6. Preservar estados em URL onde já existem, especialmente `applicationId`, `leadId`, `tab` e filtros.
7. Usar componentes existentes (`Button`, `Sheet`, `Dialog`, `SidebarTrigger`, `Card`, `Input`, `Select`) antes de criar novas primitivas.

## Diagnóstico por área

### 1. App shell e navegação

Arquivos:
- `src/app/(app)/layout.tsx`
- `src/components/app-sidebar.tsx`
- `src/components/ui/sidebar.tsx`
- `src/hooks/use-mobile.ts`

Problemas:
- `AppSidebar` usa `<Sidebar collapsible="icon" variant="inset">`, e em mobile `Sidebar` vira um `Sheet`; porém o único `SidebarTrigger` está no `SidebarFooter`, dentro da navegação que está fechada.
- O conteúdo principal recebe `p-8` em mobile, reduzindo demais a largura útil.
- Falta um cabeçalho mobile persistente com botão de menu, nome da página/app e área segura para notch.

Plano:
- Criar um componente de shell mobile, por exemplo `MobileAppHeader`, renderizado dentro de `SidebarProvider` e fora de `AppSidebar`.
- Colocar `SidebarTrigger` visível apenas em mobile (`md:hidden`) no topo do `SidebarInset`.
- Tornar esse header `sticky top-0 z-30` com fundo compatível com dark mode e `backdrop-blur`, respeitando `safe-area-inset-top`.
- Ajustar padding do conteúdo de `p-8 sm:p-10 lg:p-14...` para algo como `px-4 pb-6 pt-4 sm:px-6 md:p-8 lg:p-14...`.
- Garantir que a sidebar mobile feche ao navegar. Se o `Sheet` não fechar automaticamente em clique de link, adicionar uma variante mobile do item de navegação que chama `setOpenMobile(false)` via `useSidebar`.
- Revisar texto "Modulos do MVP" para "Módulos do MVP".

Critérios de aceite:
- Em 375px de largura, o botão de menu aparece sem depender da sidebar aberta.
- Abrir sidebar, tocar em uma rota e ver a navegação fechar.
- Nenhum conteúdo principal começa colado no notch ou atrás do header sticky.
- Desktop mantém sidebar inset/collapsible.

### 2. Primitivas responsivas

Arquivos:
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/table.tsx`
- `src/app/globals.css`

Problemas:
- `DialogContent` é sempre centralizado com `max-w-[calc(100%-2rem)]`; em celular, formulários longos ficam apertados e menos naturais que bottom/full-screen sheet.
- `SheetContent` já usa `w-3/4`, mas a sidebar mobile sobrescreve largura via CSS var. Confirmar que largura final fica confortável em 320px.
- Alguns loaders/textos usam `"..."`; padronizar para reticências (`…`) ao tocar nos arquivos.
- Tabelas têm wrapper horizontal, mas algumas telas operacionais devem virar cards em mobile para leitura.

Plano:
- Adicionar classes base ao `DialogContent` para mobile: `max-h-[calc(100svh-1rem)]`, `overflow-hidden`, e espaçamento que respeite `env(safe-area-inset-*)`.
- Para modais grandes, preferir classes por uso: `h-[calc(100svh-1rem)] sm:h-auto sm:max-h-[90vh]`, com header/footer fixos e corpo rolável.
- Garantir foco visível e `aria-label` em botões icon-only que forem adicionados.
- Padronizar botões dentro de barras de ação com `w-full sm:w-auto`.
- Criar uma convenção de CSS/classes para "page header mobile": título menor em mobile, ações empilhadas, descrição com `text-pretty` ou largura controlada.

Critérios de aceite:
- Modais principais não ultrapassam a viewport vertical em 375x667.
- Botões de fechar e ações finais continuam acessíveis após rolagem.
- Não há scroll horizontal global causado por dialogs/sheets.

### 3. Dashboard

Arquivos:
- `src/app/(app)/dashboard/page.tsx`
- `src/components/dashboard/*`

Problemas:
- O dashboard usa grids responsivos básicos, mas charts e widgets precisam ser auditados para largura mínima, labels, tooltips e overflow em 320-430px.
- Header combina filtro e refresh numa linha no `sm`; em mobile precisa ocupar largura total.

Plano:
- Revisar cada widget em `src/components/dashboard/*` e garantir que gráficos usem container responsivo real, altura estável e labels que não forcem largura.
- Ajustar `PeriodFilter` e botão `Refresh` para `w-full sm:w-auto` e wrap vertical em mobile.
- Em `KpiStrip`, manter `grid-cols-2`, mas revisar labels longos e usar `min-w-0`, `break-words` ou abreviação controlada se necessário.
- Garantir que widgets com lista/ranking usem `min-w-0` nos filhos textuais.

Critérios de aceite:
- `/dashboard` não tem overflow horizontal em 320px, 375px e 430px.
- Todos os widgets cabem em uma coluna antes de `lg`.
- Filtros e refresh são clicáveis com polegar em celular.

### 4. Candidaturas e Kanban

Arquivos:
- `src/app/(app)/applications/page.tsx`
- `src/components/applications/applications-client.tsx`
- `src/components/applications/application-create-modal.tsx`
- `src/components/applications/application-detail-modal.tsx`
- `src/components/applications/job-markdown.tsx`

Problemas:
- O board usa scroll horizontal com `min-w-max` e colunas fixas `19rem`. Isso funciona no desktop, mas em celular vira uma superfície difícil de navegar.
- O drag-and-drop é touch-first (`touch-none`) e pode competir com scroll vertical/horizontal no celular.
- A ação "Nova candidatura" não ocupa largura total em mobile.
- Modais de criação/detalhe são grandes e centralizados; precisam de comportamento quase full-screen em mobile.

Plano:
- Manter Kanban desktop como está a partir de `md` ou `lg`.
- Criar uma visualização mobile alternativa em `ApplicationsClient`:
  - Header com seletor de status/abas ou segmented control.
  - Lista vertical dos cards do status selecionado.
  - Cada card mantém abertura do detalhe.
  - Incluir ação explícita para mudar status no mobile, por exemplo `Select` ou menu de ações por card, reaproveitando `updateApplicationStatus`.
  - Não depender de drag-and-drop no mobile.
- Preservar `applicationId` na URL e abertura do `ApplicationDetailModal`.
- Ajustar botão "Nova candidatura" para `w-full sm:w-auto`.
- Em `ApplicationCreateModal` e `ApplicationDetailModal`, aplicar layout mobile full-height: header compacto, corpo com scroll próprio, footer/actions sempre alcançáveis.
- Revisar chips e títulos dos cards com `min-w-0`, `truncate`/`line-clamp` e `break-words` onde houver texto externo.

Critérios de aceite:
- Em mobile, candidaturas são navegáveis sem arrastar um board horizontal.
- É possível abrir detalhe, criar candidatura e alterar status pelo celular.
- Desktop preserva Kanban drag-and-drop.
- `applicationId` continua deep-linkável.

### 5. Leads e radar

Arquivos:
- `src/app/(app)/leads/page.tsx`
- `src/components/leads/leads-client.tsx`
- `src/components/leads/lead-detail-modal.tsx`
- `src/components/leads/monitoring-progress-display.tsx`
- `src/components/leads/monitoring-run-button.tsx`

Problemas:
- Header e CTA do radar precisam largura total em mobile.
- Formulário de filtros usa grid desktop; em mobile os botões "Filtrar"/"Limpar" devem ocupar largura total.
- `MonitoringProgressDisplay` usa `grid-cols-4` para stats, muito apertado em celular.
- Cards de lead têm ações em `flex-wrap`, mas links/botões podem ficar estreitos demais.
- Textos de vaga vindos de job board podem ser longos e quebrar layout.

Plano:
- Ajustar CTA "Rodar radar completo" para `w-full sm:w-auto`.
- Ajustar filtros para uma coluna em mobile, com actions `grid grid-cols-1 sm:flex` e botões `w-full sm:w-auto`.
- Alterar stats do monitoramento para `grid-cols-2 sm:grid-cols-4`.
- No header do monitoramento, trocar `flex items-center justify-between` por `flex-col sm:flex-row` em mobile.
- Em `LeadCard`, tornar ações `w-full sm:w-auto` e garantir que `ExternalLink`, "Aprovar lead", "Descartar" e "Criar candidatura" não gerem botões estreitos.
- Garantir `JobMarkdown` com `break-words` para links/código/textos longos.
- Revisar `LeadDetailModal` com a mesma regra de modal full-height em mobile.

Critérios de aceite:
- Durante uma varredura, o painel de progresso fica legível em 375px.
- Filtros são preenchíveis sem zoom inesperado.
- Ações primárias de lead são fáceis de tocar.

### 6. Empresas

Arquivos:
- `src/app/(app)/companies/page.tsx`
- `src/app/(app)/companies/[id]/page.tsx`
- `src/app/(app)/companies/new/page.tsx`
- `src/components/companies/company-form.tsx`
- `src/components/companies/edit-company-sheet.tsx`

Problemas:
- Cards de empresas já são razoáveis, mas footer com data e link pode apertar.
- Página de detalhe usa tabela para candidaturas associadas; em mobile, tabela operacional é menos útil que cards.
- Hero da empresa usa `text-4xl sm:text-5xl`, aceitável, mas nomes longos precisam `break-words`.
- Formulário tem bons breakpoints, mas sidebar informativa deve ficar abaixo em mobile e actions precisam largura total.

Plano:
- Em `CompanyCard`, empilhar footer em mobile: data e "Ver painel" em linhas separadas, com botão/link `w-full sm:w-auto` se necessário.
- Em `[id]/page.tsx`, renderizar cards mobile para `relatedApplications` e manter `Table` apenas em `md+`.
- Adicionar `break-words`/`min-w-0` para `company.name`, `website`, `jobsBoardUrl` e valores de `SummaryRow`.
- Revisar `EditCompanySheet` para ocupar largura confortável em mobile e ter footer/actions fixos ou sempre acessíveis.
- Confirmar `CompanyForm` com `w-full` em inputs, selects e ações finais.

Critérios de aceite:
- Página de detalhe da empresa é legível sem scroll horizontal.
- URL longa de site/job board não estoura o card.
- Edição via sheet funciona em celular.

### 7. Perfil

Arquivos:
- `src/app/(app)/profile/page.tsx`
- `src/components/profile/profile-workspace.tsx`
- `src/components/profile/profile-summary.tsx`
- `src/components/profile/profile-review-form.tsx`
- `src/components/profile/profile-upload-panel.tsx`

Problemas:
- `profile-workspace` usa título `text-[3.2rem]` no menor viewport, grande demais para celulares estreitos.
- `profile-summary` e `profile-review-form` têm muitos grids densos e editores inline; risco de overflow em linhas com múltiplos inputs/actions.
- Upload modal precisa o mesmo tratamento de modal mobile.

Plano:
- Reduzir escala mobile do título do perfil para classes discretas por breakpoint, por exemplo `text-4xl sm:text-[4rem]`, sem usar cálculo por viewport.
- Revisar todos os grids editoriais com colunas fixas e garantir fallback de uma coluna em mobile.
- Em listas editáveis, colocar botões de mover/remover/salvar em área que não force a largura dos inputs.
- Tornar ações de edição `w-full sm:w-auto`.
- Aplicar `min-w-0` em containers de links, e-mails, telefone, tags e experiências.
- Revisar `ProfileUploadPanel` para modal com corpo rolável e ações acessíveis.

Critérios de aceite:
- `/profile` abre em 375px sem título quebrando a tela.
- É possível editar e salvar seções principais pelo celular.
- Campos longos de experiência/projeto não geram overflow.

## Checklist de implementação por fases

### Fase 1 - Shell mobile obrigatório

- [ ] Criar header mobile no layout com `SidebarTrigger`.
- [ ] Ajustar padding global do conteúdo.
- [ ] Fechar sidebar mobile ao navegar.
- [ ] Corrigir label "Módulos do MVP".
- [ ] Validar `/dashboard`, `/applications`, `/leads`, `/companies`, `/profile` em 375px só para confirmar navegação.

### Fase 2 - Primitivas e modais

- [ ] Melhorar `DialogContent` para viewport mobile.
- [ ] Revisar `SheetContent` para largura e safe areas.
- [ ] Aplicar classes mobile específicas nos modais grandes: criação/detalhe de candidatura, detalhe de lead, upload/edição de perfil, edição de empresa.
- [ ] Garantir close/action acessíveis com teclado e toque.

### Fase 3 - Páginas operacionais

- [ ] Implementar visualização mobile alternativa de candidaturas.
- [ ] Ajustar leads: filtros, cards, painel de progresso e ações.
- [ ] Ajustar empresas: cards, detalhe, tabela mobile.
- [ ] Ajustar dashboard: widgets/charts/filtros.
- [ ] Ajustar perfil: título, editores inline, upload.

### Fase 4 - Auditoria fina

- [ ] Buscar classes suspeitas: `min-w-max`, `w-[`, `grid-cols-4`, `text-[`, `overflow-x-auto`, `touch-none`, `whitespace-nowrap`.
- [ ] Para cada ocorrência, decidir se é intencional, precisa wrapper, ou precisa layout mobile alternativo.
- [ ] Revisar labels/acento em PT-BR nos arquivos tocados.
- [ ] Garantir `aria-label` em novos botões icon-only.
- [ ] Garantir que inputs novos tenham `name`, label e `autocomplete` quando aplicável.

## Validação obrigatória

Comandos:

```bash
rtk npm run lint
rtk npm run build
```

Validação visual:

- Usar o servidor existente em `http://localhost:3000`.
- Não executar `npm run dev`.
- Testar viewports:
  - 320x568
  - 375x667
  - 390x844
  - 430x932
  - 768x1024
  - 1440x900

Rotas mínimas:

- `/dashboard`
- `/applications`
- `/leads`
- `/companies`
- `/companies/new`
- Uma página real de `/companies/[id]`, se houver dados locais.
- `/profile`

Fluxos mínimos:

- Abrir/fechar sidebar mobile.
- Navegar entre rotas pelo menu mobile.
- Abrir modal de nova candidatura.
- Abrir detalhe de candidatura.
- Abrir detalhe de lead.
- Usar filtros de leads.
- Abrir sheet de edição de empresa.
- Abrir upload/edição de perfil.

Critérios globais:

- Sem scroll horizontal global em mobile.
- Nenhuma ação primária inacessível atrás de header, sheet, dialog ou teclado.
- Botões tocáveis com tamanho confortável.
- Conteúdo longo quebra ou trunca de forma intencional.
- Desktop não perde a experiência atual.

## Observações de risco

- O Kanban é a maior mudança de interação. Não tente forçar drag-and-drop mobile se uma lista com ação explícita resolver melhor.
- Evite refatorar domínio, schema ou Server Actions fora do necessário para status mobile.
- Se alterar contratos de componente compartilhado (`Dialog`, `Sheet`, `Sidebar`), valide todas as telas que usam essas primitivas.
- Preserve o estado em URL das telas que já usam query params.
- Não tocar em migrations ou schema para esta tarefa.
