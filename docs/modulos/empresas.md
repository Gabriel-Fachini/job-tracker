# Módulo: Empresas

Rotas `/companies`, `/companies/new`, `/companies/[id]`. Cadastro das empresas de interesse e ponto de entrada do radar (cada empresa tem uma URL de job board).

> **Estado (2026-09-27):** logos, ações por linha (editar/excluir), diálogo de exclusão, retorno `CompanyMutationResult` e o filtro de status no radar entraram no commit `cb455cc`, no branch `feat/companies-crud-logos` (ainda não mergeado na `main` quando esta doc foi escrita). Os itens marcados com *(branch)* dependem desse merge.

## Arquivos

| Arquivo | Papel |
|---|---|
| [`src/app/(app)/companies/page.tsx`](../../src/app/(app)/companies/page.tsx) | lista (`force-dynamic`) |
| [`src/app/(app)/companies/[id]/page.tsx`](../../src/app/(app)/companies/[id]/page.tsx) | detalhe |
| [`src/app/(app)/companies/new/page.tsx`](../../src/app/(app)/companies/new/page.tsx) | criação |
| [`src/components/companies/company-form.tsx`](../../src/components/companies/company-form.tsx) | formulário de criação e opções de ATS |
| [`src/components/companies/edit-company-sheet.tsx`](../../src/components/companies/edit-company-sheet.tsx) | edição em sheet |
| [`src/components/companies/company-row-actions.tsx`](../../src/components/companies/company-row-actions.tsx) *(branch)* | editar/excluir na linha |
| [`src/components/companies/delete-company-dialog.tsx`](../../src/components/companies/delete-company-dialog.tsx) *(branch)* | confirmação de exclusão |
| [`src/components/companies/company-logo.tsx`](../../src/components/companies/company-logo.tsx) *(branch)* | tile do logo com fallback de iniciais |
| [`src/components/companies/company-status-badge.tsx`](../../src/components/companies/company-status-badge.tsx) | tag de status |
| [`src/server/actions/companies.ts`](../../src/server/actions/companies.ts) | `createCompany`, `updateCompany`, `deleteCompany`, `discoverCompanyAts` |
| [`src/components/companies/discover-ats-button.tsx`](../../src/components/companies/discover-ats-button.tsx) | botão "Descobrir ATS" do detalhe |
| [`src/lib/companies/`](../../src/lib/companies/) | `normalize.ts`, `company-index.ts`, `resolve.ts`, `ats-discovery.ts`, `yc-import.ts`, `company-store.ts`, `company-origin.ts` |
| [`src/lib/companies.ts`](../../src/lib/companies.ts) | enums, labels, `deriveCompanyStatus` |
| [`src/lib/company-links.ts`](../../src/lib/company-links.ts) | liga jobs antigos por nome, renomeia, recalcula status |
| [`src/lib/company-logos.ts`](../../src/lib/company-logos.ts) + [`src/app/api/companies/[id]/logo/route.ts`](../../src/app/api/companies/[id]/logo/route.ts) *(branch)* | busca, cache e entrega de logos |

## Campos

| Campo | Valores / regra |
|---|---|
| `name` | obrigatório |
| `sector`, `notes` | texto livre |
| `website`, `jobsBoardUrl`, `glassdoorUrl`, `logoUrl` | vazio ou URL `http:`/`https:` válida. Sem canonicalização (só `""` → `null`). |
| `size` | `startup`, `small`, `medium`, `large`, `enterprise` (inválido → `null`) |
| `status` | `monitoring` (Monitorando), `in_process` (Em processo), `discarded` (Descartada), `blacklist` (Blacklist). Inválido → `monitoring`. |
| `jobBoardNavigationMode` | `fetch` ("Fetch padrão", default) ou `browser` ("Browser renderizado", Playwright) |
| `atsProvider` | `auto` (default), `greenhouse`, `gupy`, `inhire`, `ashby`, `lever`, `generic`. Aceita qualquer string. |
| `origin` | `manual` (default), `aggregator`, `yc_import`. **Sem input na UI**: é definida por quem cria a empresa (formulário = `manual`; fonte agregada = `aggregator`; `companies:import-yc` = `yc_import`). |
| `atsBoardToken` | **sem input na UI**. Criação grava `null`; edição preserva o valor (só sobrescreve se o campo vier no FormData). Nenhum provider lê. |

Validação no servidor (`readCompanyFields` + validação em `companies.ts`): trim em tudo, nome não vazio, URLs `http(s)`. O radar usa um `isValidUrl` mais frouxo (qualquer URL parseável).

### Status

O status escolhido no formulário é salvo como está. Ele só é recalculado quando uma candidatura é criada ou muda de status (`syncCompanyStatusForApplication`); `updateCompany` não recalcula (antes de `cb455cc` recalculava a cada edição e desfazia o status manual). Regras do cálculo em [banco-de-dados.md](../banco-de-dados.md#companies).

Status e radar: `discarded` e `blacklist` ficam fora da varredura em lote (`radarSkippedCompanyStatuses`); o botão "Rodar varredura" do detalhe varre a empresa em qualquer status.

## Fluxos

### Criar

`/companies/new` → `createCompany(formData)` (form action):

- inválido → `redirect("/companies/new?error=validation")` (a página mostra um aviso; o formulário volta vazio);
- válido → insere, liga jobs antigos com o mesmo nome (`linkLegacyJobsToCompany`) sem recalcular o status (o do form vale) → `redirect("/companies/<id>")`.

### Editar

`EditCompanySheet` (a partir da lista ou do detalhe) abre preenchido com os dados já carregados, sem fetch. Usa `onSubmit` + transition com `updateCompany(id, formData)`, que devolve `{ ok: true }` ou `{ ok: false, error: "validation" | "not-found" }`. Erro aparece no rodapé fixo e o que foi digitado fica. Renomear atualiza `jobs.company` (`renameCompanyLinks`). Mudar `website` ou `logoUrl` limpa o cache de logo.

### Excluir *(branch)*

`deleteCompany(id, { redirectToList? })`:

1. Se existir qualquer `jobs` ligado → `{ ok: false, error: "linked-applications" }`.
2. Senão, numa transação: apaga os dados do Glassdoor da empresa (salários, snapshots, avaliações, entrevistas), os `job_leads` e a empresa (FK ligada; sem cascade).
3. Remove o arquivo de logo e revalida `/companies`, `/companies/<id>`, `/applications`, `/leads`.
4. Com `redirectToList` (usado no detalhe) → `redirect("/companies")`.

UI: `canDelete = jobsCount === 0`. O diálogo mostra quantos leads vão junto. Bloqueado (fluxo das ações da linha), mostra quantas candidaturas existem e oferece "Mudar status"; no sheet de edição (único caminho no detalhe) o botão "Excluir empresa" fica desabilitado. No diálogo: se a empresa já está Descartada/Blacklist, avisa que ela continua na lista com esse status; senão, sugere mudar para Descartada ou Blacklist. Sucesso invalida `["leads"]` e mostra toast. O diálogo não fecha durante a exclusão e fica aninhado no sheet de edição para não fechá-lo.

### Radar

- Lista: botão "Rodar varredura" → `runAllCompaniesMonitoring()` (Server Action, sem SSE; pula `discarded`/`blacklist`).
- Detalhe: "Rodar varredura" → `runCompanyMonitoring(id)` (uma empresa, qualquer status) e "Ver leads" → `/leads?companyId=<id>`.

Como esses caminhos não usam SSE, o indicador "Radar em execução" da sidebar e o ponto na navegação mobile **não** acendem. Empresa sem URL válida devolve "Empresa fora do radar monitoravel.".

## Origem, importação YC e descoberta de ATS

- Empresas criadas por fontes agregadas (`origin = aggregator`, radar desligado até achar um board) e importadas da YC (`origin = yc_import`) aparecem na lista com uma `Tag` ("via agregador" / "YC"). Quando existe alguma, surge o filtro "Origem" (Todas as origens / Manual / Via agregador / YC) ao lado do filtro de status, e o parâmetro `?origin=` guarda a escolha na URL.
- Ordem da lista: cadastradas pelo usuário primeiro, depois as demais, cada grupo por `updated_at DESC`. Acima de 60 linhas a entrada animada é desligada (o `trail` de 20 ms levaria segundos com centenas de empresas).
- Logos: só as empresas `manual` disparam a busca automática de logo ao aparecer na lista. As demais mostram as iniciais (a não ser que já tenham logo em cache ou `logo_url`), para que importar 700 empresas não gere 700 requisições na primeira visita.
- A empresa "sink" `Vagas descartadas (agregadores)` (guarda os leads descartados de fontes) não aparece na lista.
- Detalhe: mostra a tag de origem e, **quando a empresa não tem job board**, o botão "Descobrir ATS" (`discoverCompanyAts`): procura Ashby/Lever/Greenhouse no site e pelo nome; achando, grava o board + `ats_provider` e liga o radar (o toast avisa quando foi achado só pelo nome). Empresas com board não são tocadas.
- Importação em massa: `npm run companies:import-yc [-- --dry-run] [-- --limit N]` (detalhes no [radar](../radar-manual-de-vagas-implementacao.md#importação-yc-e-descoberta-de-ats)).

## Lista

- Uma query ordenada (ver acima), contagens por subquery correlacionada. Filtros de status e origem e busca; sem paginação.
- Cabeçalho: "N empresas · M candidaturas · K no radar", "Rodar varredura" (outline), "Importar JSON do Glassdoor" (outline; só ícone abaixo de `xl`, resultado em `Notice` sob o cabeçalho) e "Nova empresa". As tags de resumo por status (somente leitura) ficam na barra do topo do painel da lista.
- Linha: logo, nome (link que cobre a linha toda), site legível, meta (setor · porte · N candidaturas), tag de status, data (`sm:block md:hidden lg:block`: some de novo entre 768 e 1023 px), ações em `z-10`. `has-[a[data-row-link]:active]` evita que tocar numa ação acenda a linha.
- Ações *(branch)*: a partir de `sm`, botões de ícone com tooltip; no telefone, "⋯" abre bottom sheet com Ver detalhes, Editar, Abrir site, Excluir.

## Detalhe

- `notFound()` para id não inteiro ou inexistente.
- Cabeçalho: voltar, logo + nome, status · porte · atualização; ações "Ver leads" e "Rodar varredura" (primária).
- Notas (ou placeholder).
- "Candidaturas associadas": "X ativas de Y"; lista abaixo de `lg`, tabela a partir de `lg`; links para `/applications?applicationId=`.
- "Ficha da empresa": Site, Setor, Porte, Job board, Navegação, Glassdoor, Status + botão Editar. Provider ATS e URL de logo não aparecem.
- Painel "Glassdoor" (largura total, abaixo dos dois blocos): notas, avaliações, entrevistas e salários da última coleta, com upload manual do JSON. Ver [glassdoor.md](glassdoor.md).

## Logos *(branch)*

Fonte: `logo_url` (override manual) ou o próprio `website`. Nenhum serviço de terceiros.

- **Quando buscar**: `getCompanyLogoView` (sem I/O) decide no render. Com arquivo em cache → `/api/companies/<id>/logo?v=<hash>`. Busca pendente (nunca buscou, ou última tentativa há ≥ 3 dias) → URL sem `v` e estado `pending`. Senão, iniciais.
- **Busca** (`readCompanyLogo`, disparada pelo primeiro GET da rota): baixa a home, respeita `<base href>`, pontua os `<link>` (apple-touch-icon > ícone raster grande > SVG > ícones pequenos) e sempre adiciona `/apple-touch-icon.png` e `/favicon.ico`. Tenta até 5 candidatos. Requisições simultâneas compartilham a mesma promessa.
- **Validação do arquivo**: formato por magic bytes (png, jpg, gif, webp, avif, ico, svg), não pelo `Content-Type`; rejeita ícones menores que 16 px (dimensão só é lida em PNG, GIF e ICO; JPG, WebP, AVIF e SVG passam em qualquer tamanho). O `GET` da rota tem efeito colateral: busca o site, grava o arquivo e atualiza `logo_path`/`logo_checked_at`.
- **Limites atuais** (constantes em `company-logos.ts`): página ≤ 2 MB, imagem ≤ 1 MB, prazo total 10 s, 5 s por request, até 4 redirects, nova tentativa em 3 dias sem ícone e em 30 min após falha transitória.
- **Proteção SSRF**: redirects seguidos manualmente e revalidados a cada salto; só `http(s)`; todas as respostas DNS checadas contra faixas bloqueadas (privadas, loopback, CGNAT/tailnet `100.64/10`, link-local/metadata, TEST-NET, multicast, reservadas e equivalentes IPv6). A checagem se repete no `lookup` do `Agent` do `undici` usado pelo `fetch`, sobre os endereços em que o socket conecta (fecha DNS rebinding).
- **Armazenamento**: `<UPLOADS_PATH>/logos/<id>-<sha256[0:12]>[-cover].<ext>`; `companies.logo_path` e `logo_checked_at`. A gravação só vale se `website`/`logo_url` não mudaram durante a busca; o arquivo antigo é removido.
- **Rota** `GET /api/companies/[id]/logo` (`runtime = "nodejs"`, `force-dynamic`): 404 `no-store` sem logo; com `?v=` igual à versão atual → `private, max-age=31536000, immutable`; senão `private, no-cache`. Sempre `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` e `X-Content-Type-Options: nosniff` (bytes de terceiros; um SVG aberto direto não executa script).
- **Render** (`company-logo.tsx`): tile de 40 px `aria-hidden` sobre o token `--logo-tile` (claro nos dois temas, porque favicons são desenhados para aba clara); apple-touch-icon preenche (`cover`), outros ficam com padding (`contain`). Sem logo: iniciais (ignora "de/da/do/e/of/the/&"). `<img>` simples porque `next/image` não aceita ICO/SVG.

## Armadilhas

- O erro de exclusão se chama `linked-applications`, mas o bloqueio é por **qualquer** `jobs` ligado.
- `jobs.company_id` é `NOT NULL` desde `0004`; o ramo "job antigo sem `company_id`" de `company-links.ts` provavelmente nunca casa num banco migrado (inferência).
- Criação via form action perde o que foi digitado quando o servidor rejeita (ex.: `ftp://` passa no `type=url` do navegador).
