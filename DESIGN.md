---
name: Job Tracker
description: Personal job-hunting operations center, adapted from Notion's design language. Warm neutrals, one purple action, pastel property tags; dark by default, light on request.
colors:
  # Dark theme (default): absolute black content inside a warm graphite frame.
  canvas: "#1c1b19"
  background: "#000000"
  surface: "#141312"
  popover: "#22211f"
  field: "#131211"
  muted: "#252422"
  accent: "#2c2b28"
  border: "#2e2d2a"
  border-strong: "#3d3b37"
  foreground: "#ebeae6"
  muted-foreground: "#b4b2ab"
  subtle-foreground: "#9a9892"
  primary: "#6c5ce6"
  primary-hover: "#5b4ad8"
  primary-foreground: "#ffffff"
  ring: "#8f84f2"
  link: "#62aef5"
  positive: "#5cc97a"
  caution: "#f0913f"
  negative: "#f2665e"
  tag-gray: "#2f2e2b"
  tag-gray-foreground: "#d2d0ca"
  tag-orange: "#4a2a12"
  tag-orange-foreground: "#f7c49b"
  tag-green: "#17371f"
  tag-green-foreground: "#9fdcb0"
  tag-blue: "#15314d"
  tag-blue-foreground: "#a4cdf7"
  tag-purple: "#2d2656"
  tag-purple-foreground: "#c9befa"
  tag-red: "#4b1e1a"
  tag-red-foreground: "#f6aea6"
  # Light theme: white content inside a warm-gray frame, charcoal text.
  light-canvas: "#f6f5f4"
  light-background: "#ffffff"
  light-surface: "#f7f6f3"
  light-popover: "#ffffff"
  light-field: "#ffffff"
  light-muted: "#f1f0ed"
  light-accent: "#eeece9"
  light-border: "#e5e3df"
  light-border-strong: "#cfcbc5"
  light-foreground: "#37352f"
  light-muted-foreground: "#5d5b54"
  light-subtle-foreground: "#6b6963"
  light-primary: "#5645d4"
  light-primary-hover: "#4534b3"
  light-primary-foreground: "#ffffff"
  light-ring: "#5645d4"
  light-link: "#006ccf"
  light-positive: "#18803a"
  light-caution: "#b45000"
  light-negative: "#cc2b2b"
  light-tag-gray: "#efedea"
  light-tag-gray-foreground: "#55534e"
  light-tag-orange: "#ffe8d4"
  light-tag-orange-foreground: "#793400"
  light-tag-green: "#dcf1e1"
  light-tag-green-foreground: "#1d5a2f"
  light-tag-blue: "#dcecfa"
  light-tag-blue-foreground: "#0b4f8a"
  light-tag-purple: "#e6e0f5"
  light-tag-purple-foreground: "#4534b3"
  light-tag-red: "#fde4e1"
  light-tag-red-foreground: "#a3261b"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.35
  section:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    fontFeature: "tnum, zero"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  row-y: "14px"
  panel: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    border: "1px solid {colors.border-strong}"
    rounded: "{rounded.lg}"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    height: "28px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.foreground}"
    border: "1px solid {colors.border-strong}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  search-pill:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    height: "32px"
  pill-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.full}"
    height: "28px"
  pill-tab-active:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
  tab-active:
    textColor: "{colors.foreground}"
    border: "0 0 2px {colors.foreground} solid"
  tag-status:
    backgroundColor: "{colors.tag-green}"
    textColor: "{colors.tag-green-foreground}"
    rounded: "{rounded.full}"
    height: "20px"
  tag-select:
    backgroundColor: "{colors.tag-gray}"
    textColor: "{colors.tag-gray-foreground}"
    rounded: "{rounded.sm}"
    height: "20px"
  panel:
    backgroundColor: "{colors.background}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.xl}"
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
---

# Design System: Job Tracker

## 1. Overview

**Creative North Star: "A Notion workspace for one job hunt"**

A tool one engineer uses every day to move job leads into submitted applications. It borrows Notion's product language: warm off-white and charcoal (or black and warm graphite), calm sentence-case type in Inter, rectangular controls with soft 8px corners, 12px panels, and color concentrated in two places: one purple button for the main action, and pastel property tags for state. Everything else is neutral, hairline-structured and dense.

The source reference is Notion's marketing design system (purple `#5645d4` CTA, pastel tints, 8/12px radii, pill tabs, underline tabs). Only the product-relevant parts are adopted. The marketing pieces (navy hero band, sticky-note decoration, pastel feature cards, pricing tiers, testimonials, logo wall, footer) have no place in a sidebar app and are out.

Two themes. Dark is the default: content on `#000` inside a warm graphite frame. Light: white content inside a warm-gray frame with charcoal text. The user picks Sistema / Claro / Escuro (sidebar footer, or Perfil → Aparência); the choice is stored per device and applied before first paint.

It rejects, by name (from PRODUCT.md): generic SaaS dashboards (gray card grids, hero metrics, identical card columns, "enterprise" roundedness); recruitment-platform UIs (Greenhouse, LinkedIn, Indeed, dense HR tables); and gradient-heavy, animation-first portfolio tools.

**Key Characteristics:**
- Warm neutrals in both themes; depth by lightness steps, not decorative shadow.
- One purple primary button per view; everything else outline or ghost. Purple also marks keyboard focus.
- Workflow state as pastel status tags (tint + deep text + dot); categories as gray select tags.
- Inter for UI (optical sizes on), Geist Mono (`font-data`) for every number, date, score, count.
- Hairline dividers, rows over cards, panels over boxes-in-boxes.
- Sentence case everywhere. No uppercase tracked eyebrows.

## 2. Colors: The Warm Workspace Palette

### Neutral roles (dark / light)
- **Canvas** (`--canvas`, #1c1b19 / #f6f5f4): app frame behind the content panel, sidebar, mobile tab bar, log wells.
- **Background** (`--background`, #000000 / #ffffff): the content panel and every page surface. Panels use this value plus a border.
- **Surface** (`--surface`, #141312 / #f7f6f3): row hover, table-header fills, search pill, empty-state icon tiles.
- **Popover** (`--popover`, #22211f / #ffffff): dialogs, sheets, menus, toasts.
- **Field** (`--field`, #131211 / #ffffff): input, select and textarea fills.
- **Muted / Accent** (`--muted`, `--accent`): skeletons, meter tracks, code, ghost/menu hover.
- **Border** (`--border`, #2e2d2a / #e5e3df): hairline dividers and panel outlines.
- **Border Strong** (`--border-strong` / `--input`, #3d3b37 / #cfcbc5): input and outline-button strokes.
- **Foreground** (#ebeae6 / #37352f charcoal): primary text, titles, values.
- **Muted Foreground** (#b4b2ab / #5d5b54): secondary text, descriptions, meta. ≥5.7:1 everywhere.
- **Subtle Foreground** (#9a9892 / #6b6963): tertiary text: timestamps, separators, placeholders, inactive tabs. ≥4.5:1 on every surface, including hover fills; it is the floor.

### Brand
- **Primary** (#6c5ce6 dark / #5645d4 light): the page's main action and nothing else. White text at 4.8:1 / 6.6:1. Hover #5b4ad8 / #4534b3.
- **Ring** (#8f84f2 / #5645d4): focus ring and focused input border.
- **Link** (#62aef5 / #006ccf): inline text links (`Button variant="link"`, markdown links). The spec's #0075de is darkened to keep 4.5:1 on the frame. Never mix link blue and primary purple roles.
- **Selection:** purple at 16% (light) / 30% (dark).

### Property tags
Each tag color is a tint plus deep text of the same hue (light) or a deep tint plus light text (dark); text passes 6:1 on its tint in both themes. Colors: `gray`, `orange`, `green`, `blue`, `purple`, `red`, plus `muted` (outlined, no fill) for closed or inactive states.

### Semantic (inline feedback)
- **Positive** (#5cc97a / #18803a), **Caution** (#f0913f / #b45000), **Negative** (#f2665e / #cc2b2b): notice dots, score numbers, deltas, destructive actions. Info (#62aef5 / #006ccf) is the "in progress" dot.
- Green and orange are close for protan/deutan readers (CIEDE2000 ~9-11 simulated): never place them adjacent in a chart; keep a neutral segment between them.

### Charts
`--chart-1` (most prominent) to `--chart-5` (least), warm neutral ramp. `--chart-3` clears 4.5:1 and `--chart-4` ~3:1 on the background; `--chart-5` is decorative only. Status series use the semantic tokens. Purple never appears in charts.

### Named Rules
**The One-Purple Rule.** Purple fills exactly one thing per view: the primary button. Not links, not charts, not selected states (selected pills and tabs use ink).

**The Tag Rule.** Color on a container is allowed only as a property tag (`Tag`) that names a state or category. No tinted panels, stat tiles or alert boxes.

**The Token Rule.** Only tokens from `globals.css`. Never a Tailwind palette color (`emerald-400`, `sky-400/8`...), literal hex/oklch, `bg-black`, `text-white` or `shadow-black/*` in components: both themes must work from the same class names.

**The Floor Rule.** `subtle-foreground` is the dimmest legal text. No alpha text like `text-muted-foreground/60`.

## 3. Typography

**UI Font:** Inter (`font-sans`, `--font-inter`, `opsz` axis loaded). Notion Sans is proprietary; Inter is its base.
**Data Font:** Geist Mono (`font-data` utility: mono + tabular + slashed zero)

### Hierarchy
- **Headline** (600, 28px / 22px on phones, tracking -0.02em): page titles, via `PageHeader` only.
- **Title** (500, 15px): row titles, entity names; dialog titles 16px semibold.
- **Section** (600, 14px): panel headings (`PanelTitle`), form sections. Sentence case.
- **Body** (400, 14px, line-height 1.5): UI text and prose. Long prose capped at `max-w-[68ch]`.
- **Meta** (400, 13px, `muted-foreground`): company, seniority, location, descriptions.
- **Label** (500, 12px): tags, field labels, table headers.
- **Data** (`font-data`, 12-15px; KPI values 24-28px medium): scores, counts, dates, deltas, percentages, IDs.

### Named Rules
**The Data-Face Rule.** Every number a user compares is set in `font-data`. Words stay in Inter.

**The No-Eyebrow Rule.** Never `text-[11px] uppercase tracking-[0.18em]` labels. Use a sentence-case Section heading.

## 4. Elevation

Flat by default (Notion level 0: hairline border, no shadow). Shadows only on floating layers, via tokens: menus use `shadow-popover` (`0 4px 12px rgb(15 15 15 / .08)` + soft spread), dialogs and sheets use `shadow-overlay` (Notion's modal level, `0 16px 48px -8px rgb(15 15 15 / .16)`). Dark theme uses strong black shadows plus borders. Backdrops use `bg-overlay`, no blur.

### Named Rules
**The Hairline Rule.** Structure is 1px `border-border`. No double borders, no side stripes, no nested cards.

## 5. Components

Primitives live in `src/components/ui/`. Use them; don't restyle height or radius at the call site.

### Buttons (`Button`, `buttonVariants`)
- **Shape:** `rounded-lg` (8px); `sm`/icon-sm `rounded-md` (6px). Heights: `sm` 28px, `default` 32px, `lg` 36px; touch pointers get +8px.
- **Primary (`default`):** purple, white text, one per view (Rodar radar, Nova candidatura, Salvar).
- **Outline:** `border-border-strong`, foreground text, `hover:bg-accent`. Row-level main action (Aprovar) and secondary page actions.
- **Ghost:** muted text, `hover:bg-accent`. Tertiary: Descartar, Editar, icon buttons.
- **Destructive:** `bg-destructive/12 text-destructive`. **Link:** `text-link`, underline on hover.
- **Focus:** 3px purple halo (`ring-3 ring-ring/40`). **Disabled:** 40% opacity. Pending labels end with an ellipsis.

### Tags (`Tag`, `TagDot` in `ui/tag.tsx`)
- `variant="status"`: 20px pill, dot + label. Workflow state:
  - Leads: interesting `green`, review `orange`, discarded `muted`.
  - Applications (`applicationStatusColor`): applied `gray`, in_process `blue`, offer `purple`, approved `green`, rejected `red`, withdrawn `muted`.
  - Companies (`companyStatusColor`): monitoring `gray`, in_process `blue`, discarded `muted`, blacklist `red`.
- `variant="select"`: 20px, 4px corners, no dot: categories.
- `TagDot`: the same mid-tone dot on its own (status select, legends).
- **Chip** (`ui/chip.tsx`): gray select tag for skills and keywords; `positive`/`caution`/`info` tints for judgements only.

### Status (`Status`, `StatusDot` in `ui/status.tsx`)
Inline dot + quiet label for feedback, not workflow state ("Currículo gerado com sucesso", classifier health). Live state (radar running): `StatusDot tone="active" pulse` (blue).

### Panels and lists
- **Panel** (`ui/panel.tsx`): `Panel` (12px, hairline), `PanelHeader` (44px bar), `PanelTitle` (Section), `PanelMeta`, `PanelBody` (`p-4 sm:p-5`). Never nest.
- **Notice** (`ui/notice.tsx`): one-line feedback with a semantic dot; `bordered` when alone, `pulse` in progress.
- **MetaLine** (`ui/meta-line.tsx`): items joined by middots, falsy items skipped.
- **List panel:** `rounded-xl border` section, header bar (`TabBar` or summary tags), `divide-y` rows (`px-4 py-3.5 sm:px-5`, `hover:bg-surface`), whole row clickable with actions at `relative z-10`.
- **Panel grid (dashboards):** shared hairlines (`gap-px bg-border`), not separate cards.
- **Metric strip:** one bordered `dl`, `dt` 13px muted, `dd` `font-data text-2xl`, optional delta. No icons, no tints.

### Tabs and toggles
- **TabBar** (`ui/tab-bar.tsx`): underline view tabs; inactive `subtle-foreground`, active foreground with a 2px ink rule; count in `font-data`.
- **SegmentedControl** (`ui/segmented-control.tsx`): Notion pill tabs. 28px outlined pills, `rounded-full`; pressed pill filled with ink (`bg-foreground text-background`). Period, classification, theme.

### Inputs / Fields
- `Input`, `Textarea`, `SelectTrigger`, `NativeSelect`: 32px, `rounded-lg`, `border-input`, `bg-field`, placeholder `subtle-foreground`.
- **Focus:** purple border + `ring-2 ring-ring/25`. **Error:** `aria-invalid` → destructive border and ring.
- **Search pill:** list search uses `bg-surface` + `border-border`, turning `bg-field` on focus.

### Dialogs, sheets, tooltips
Dialogs and sheets: `bg-popover`, hairline border, `rounded-xl`, header/footer hairlines, body in `ScrollArea`; phones get the bottom sheet (`rounded-t-2xl`). Tooltips are dark in both themes (`bg-tooltip`), 12px medium, 6px corners.

### Empty states
`Empty` inside the panel that would hold the content: bordered icon tile, 14px title, 13px description with the next step, one outline action.

### Navigation
Sidebar on canvas: `jt` monogram (CSS mask on `bg-foreground`) + `job-tracker` in the data face; 32px items, icons in `subtle-foreground`, active item `bg-sidebar-accent` + foreground. Radar-running row in the footer (blue pulsing dot + `font-data` progress). Footer: `ThemeToggle` pills (icons only; `ThemeCycleButton` when collapsed) next to the collapse trigger. Phones: bottom tab bar on canvas, active tab with a top ink rule; theme picker in Perfil → Aparência.

### Theme
`src/lib/theme.ts` (preference type, storage key, `<head>` anti-flash script) and `src/hooks/use-theme.ts` (`useThemePreference`, `useResolvedTheme`, `setThemePreference`; freezes transitions during the swap, syncs across tabs and with the OS). Default for a new device: dark.

### Brand mark
`public/brand/jt-monogram.png` is the source; `jt-mark.png` the trimmed mask. App icons (`src/app/icon.png`, `apple-icon.png`, `favicon.ico`) put the white glyph on a graphite tile.

### Charts
Warm neutral ramp; semantic tokens for status series; hairline grid `var(--border)`; ticks in `font-data` 10-11px `subtle-foreground`; tooltip on `popover`. Bars and stacked bars over pies.

## 6. Do's and Don'ts

### Do:
- **Do** use one purple primary button per view; row actions outline or ghost.
- **Do** show workflow state as a status `Tag`, categories as select tags or chips.
- **Do** set every number in `font-data`.
- **Do** build lists as hairline-divided rows inside one panel, whole row clickable.
- **Do** keep page descriptions to real information: "8 na triagem · 2 aprovados".
- **Do** respect `prefers-reduced-motion`; motion 150-200ms, `ease-out-quart`, state changes only.
- **Do** keep text at or above `subtle-foreground` (4.5:1) and prose under 68ch.

### Don't:
- **Don't** import Notion's marketing pieces: navy hero bands, sticky-note or mesh decoration, pastel feature cards, pricing tiers, testimonials, logo walls.
- **Don't** use purple for text, links, charts, selected states or large surfaces.
- **Don't** build generic SaaS dashboards (card grids, hero metrics, identical card columns) or recruitment-platform UIs.
- **Don't** add gradients, glows, glassmorphism, `backdrop-blur`, gradient text or animated shine.
- **Don't** assume a theme: no palette colors, hex, oklch, `bg-black/*`, `text-white`, `shadow-black/*` in components.
- **Don't** tint containers except property tags; no colored stat tiles or alert boxes.
- **Don't** use uppercase tracked eyebrows.
- **Don't** round containers past `rounded-xl` (sheets on phones excepted); `rounded-full` is for pills, tags and dots only.
- **Don't** use side stripes wider than 1px or nest bordered boxes.
- **Don't** use em dashes in copy; use a period, colon or parentheses.
