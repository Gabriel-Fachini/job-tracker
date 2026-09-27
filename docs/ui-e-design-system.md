# UI e design system

A especificação normativa é [`DESIGN.md`](../DESIGN.md) (tokens, receitas de componentes, do's/don'ts). O contexto de produto e princípios estão em [`PRODUCT.md`](../PRODUCT.md). Este documento é o mapa de onde cada coisa está no código.

## Linguagem visual

Adaptada da Notion (commit `05d892a`, 2026-09-27): neutros quentes, roxo só no botão principal (um por tela) e no foco, status como tags pastel.

- **Escuro (padrão)**: conteúdo em `#000` dentro de moldura grafite quente.
- **Claro**: branco com texto charcoal `#37352f`.
- Ambos compartilham os mesmos nomes de token e o mesmo piso de contraste.

Regras que mais quebram em revisão (resumo do DESIGN.md):

1. **Só tokens** de `src/app/globals.css`. Nada de paleta Tailwind (`emerald-400`…), hex, `oklch` literal, `bg-black`, `text-white`, `shadow-black` em componentes.
2. **Um roxo por tela**: roxo só no botão primário único e no anel de foco. Pills/abas selecionadas usam tinta (ink), não roxo.
3. **Cor em container só via `Tag`**; cada entidade tem seu mapa status → cor.
4. **Piso de texto**: `subtle-foreground` é o mais apagado permitido (≥ 4.5:1). Sem texto com alpha. Prosa ≤ 68ch.
5. **Tipografia**: Inter; título só via `PageHeader`; **todo número em `font-data`** (Geist Mono, tabular). Sentence case, sem eyebrow em caixa alta.
6. **Plano**: sombra só em camadas flutuantes (`shadow-popover`, `shadow-overlay`). Sem borda dupla, faixa lateral, card dentro de card ou panel dentro de panel.
7. **Raios** 4/6/8/12 px; nada acima de `rounded-xl` (exceto sheets no telefone); `rounded-full` só em pills, tags e dots.
8. **Movimento** 150–200 ms ease-out-quart, só para mudança de estado, respeitando `prefers-reduced-motion`. Sem gradiente, glow, glass, backdrop-blur.
9. **Texto**: sem travessão (em dash) na copy; descrições de página com dados reais.
10. **Listas**: linhas separadas por hairline dentro de um panel, linha inteira clicável, ações em `relative z-10`; estado vazio dentro do panel com uma ação outline.

## Tema

| Peça | Arquivo | Detalhe |
|---|---|---|
| Script anti-flash | [`src/lib/theme.ts`](../src/lib/theme.ts) | inline no `<head>`, ES5; aplica classe `light`/`dark` e `colorScheme` antes do primeiro paint |
| Hook | [`src/hooks/use-theme.ts`](../src/hooks/use-theme.ts) | `useThemePreference`, `useResolvedTheme` (`useSyncExternalStore`), `setThemePreference`; sincroniza entre abas (`storage`) e segue o SO em `system` |
| Persistência | `localStorage["theme"]` | `light` · `dark` · `system`; default e fallback (storage bloqueado) = `dark` |
| Seletor | [`src/components/theme-toggle.tsx`](../src/components/theme-toggle.tsx) | Sistema/Claro/Escuro no rodapé da sidebar e em Perfil → Aparência; botão de ciclo com sidebar recolhida |

Ao trocar de tema, as transições são desligadas por um tick (via `setTimeout`, porque `requestAnimationFrame` não dispara em aba oculta) e todos os `meta[theme-color]` são reescritos.

CSS: tokens claros em `:root`, escuros em `.dark` (`@custom-variant dark (&:is(.dark *))`). A classe `.light` não tem regras próprias.

## Tokens (`globals.css`)

- `@theme inline` mapeia tokens para cores, fontes, sombras, raios (4/6/8/12/16, mais `--radius-3xl` 20 e `--radius-4xl` 24) e easings do Tailwind 4.
- Por tema: neutros (`canvas`, `background`, `surface`, `popover`, `field`, `muted`, `accent`, `border`, `border-strong`, `input`), texto (`foreground`, `muted-foreground`, `subtle-foreground`), marca (`primary`, `primary-hover`, `ring`, `link`, `selection`), semânticos (`info`, `positive`, `caution`, `negative`, `destructive`), `tooltip`, `logo-tile` (fundo dos logos de empresa), 6 pares de cor de tag, `chart-1..5`, `sidebar-*`, `overlay`, elevação.
- Só no bloco claro (valem para os dois): raio base, camadas de z-index (30 sticky, 40 nav, 45 action bar; overlays usam a classe `z-50` do Tailwind), `--mobile-nav-height`.
- Utilitários: padding de safe-area, `font-data` (mono, números tabulares, zero cortado), `scrollbar-none`, controles a 16 px em telas touch (evita zoom do iOS), override de reduced-motion.

Fontes: Inter com eixo `opsz` (`--font-inter`, texto e títulos) e Geist Mono (`--font-geist-mono`, `font-data`).

## Primitives (`src/components/ui/`)

Próprios:

| Componente | Uso / props principais |
|---|---|
| `Tag`, `TagDot` | `color`: gray · orange · green · blue · purple · red · muted; `variant`: status (pill + dot) · select |
| `Status`, `StatusDot` | `tone`: active · neutral · positive · caution · negative · muted; `pulse` |
| `Panel` (+ `PanelHeader`, `PanelTitle`, `PanelMeta`, `PanelBody`) | container com borda; nunca aninhar |
| `Notice` | feedback de uma linha com dot semântico; `tone`, `pulse`, `bordered`; `role="note"` |
| `MetaLine` | itens separados por "·", ignora falsy |
| `TabBar`, `TabBarItem` | abas com `selected` e `count` (sem navegação por setas) |
| `SegmentedControl`, `SegmentedControlItem` | botões `aria-pressed`, `pressed`, `count` |
| `NativeSelect` | `<select>` nativo para forms não controlados |
| `Chip` | `tone`: neutral · positive · caution · info · muted |

Derivados do registry shadcn e reestilizados: `Empty`, família `Field`.

Stock shadcn `base-nova` sobre Base UI: badge, button (tamanhos xs · sm · default · lg · icon-*; maiores em touch), card, input, label, scroll-area, select, separator, sheet, sidebar, skeleton, table, textarea, tooltip (delay 0). Customizados: `dialog` (vira Drawer arrastável no telefone; `sheetSize` auto · full) e `sonner` (posição e tema).

Adicionar componente shadcn: skill `shadcn` / MCP `shadcn` (config em [`components.json`](../components.json): estilo `base-nova`, ícones Lucide, aliases `@/components`, `@/lib`, `@/hooks`).

## Navegação e layout

- Itens ([`src/lib/navigation.ts`](../src/lib/navigation.ts)): Dashboard, Perfil, Empresas, Candidaturas, Leads. Ativo por match exato ou prefixo `href/`.
- **Desktop (≥ 768 px)**: sidebar `collapsible="icon"`, `variant="inset"`, 15rem (3rem recolhida), atalho ⌘/Ctrl+B, linha "Radar em execução" durante run SSE. O estado é gravado no cookie `sidebar_state`, mas nunca lido (reinicia a cada carga).
- **Telefone (< 768 px)**: `MobileNav` fixa com 5 abas (3.75rem + safe area, `z-40`, ponto pulsante em Leads durante o radar). A sidebar vira Sheet sem gatilho visível. A tab bar se esconde quando um campo de texto está focado em telas touch estreitas.
- **< 640 px**: `Dialog` vira bottom sheet (Drawer do Base UI).
- `useIsMobile` (< 768) e `PHONE_QUERY` (≤ 639) retornam `false` no servidor: o primeiro render é sempre o desktop.
- Toasts: topo-centro no mobile, canto inferior direito no desktop.
- `PageHeader`: `title`, `description`, `actions`, `actionsPlacement` (inline · stacked), `leading`; usa grid-areas para não sobrar gap.
- Conteúdo limitado a 76rem; padding inferior no telefone reserva espaço para a tab bar.

O plano de adaptação mobile (histórico) está em [`RESPONSIVE_UI_PLAN.md`](../RESPONSIVE_UI_PLAN.md) — parte dele (ex.: "tema dark-only") foi superada pelo redesign com tema claro.

## Marca e ícones

- Monograma: `public/brand/jt-monogram.png` (fonte) e `jt-mark.png` (máscara usada na sidebar).
- Ícones do app: `src/app/icon.png`, `apple-icon.png`, `favicon.ico`.
- `public/logo.png` é usado nos READMEs; `public/logo-text.png` não é referenciado.

## Skills úteis

`impeccable` (crítica/polimento de UI), `frontend-design`, `shadcn`, `vercel-react-best-practices`, `react-best-practices`. Ver [harness-de-agentes.md](harness-de-agentes.md).
