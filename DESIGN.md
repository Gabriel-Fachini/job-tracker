---
name: Job Tracker
description: Personal job-hunting operations center. Monochrome and precise; dark by default, light on request.
colors:
  # Dark theme (default): absolute black content inside a graphite frame.
  canvas: "oklch(0.19 0 0)"
  background: "oklch(0 0 0)"
  surface: "oklch(0.17 0 0)"
  popover: "oklch(0.2 0 0)"
  field: "oklch(0.14 0 0)"
  muted: "oklch(0.22 0 0)"
  accent: "oklch(0.26 0 0)"
  border: "oklch(0.265 0 0)"
  border-strong: "oklch(0.33 0 0)"
  foreground: "oklch(0.95 0 0)"
  muted-foreground: "oklch(0.72 0 0)"
  subtle-foreground: "oklch(0.64 0 0)"
  primary: "oklch(0.95 0 0)"
  primary-hover: "oklch(0.86 0 0)"
  primary-foreground: "oklch(0.12 0 0)"
  ring: "oklch(0.7 0 0)"
  positive: "oklch(0.79 0.12 158)"
  caution: "oklch(0.83 0.11 82)"
  negative: "oklch(0.72 0.14 24)"
  # Light theme: white content inside a light-gray frame.
  light-canvas: "oklch(0.97 0 0)"
  light-background: "oklch(1 0 0)"
  light-surface: "oklch(0.972 0 0)"
  light-popover: "oklch(1 0 0)"
  light-field: "oklch(1 0 0)"
  light-muted: "oklch(0.955 0 0)"
  light-accent: "oklch(0.94 0 0)"
  light-border: "oklch(0.915 0 0)"
  light-border-strong: "oklch(0.86 0 0)"
  light-foreground: "oklch(0.18 0 0)"
  light-muted-foreground: "oklch(0.44 0 0)"
  light-subtle-foreground: "oklch(0.52 0 0)"
  light-primary: "oklch(0.18 0 0)"
  light-primary-hover: "oklch(0.32 0 0)"
  light-primary-foreground: "oklch(0.985 0 0)"
  light-ring: "oklch(0.5 0 0)"
  light-positive: "oklch(0.5 0.12 155)"
  light-caution: "oklch(0.545 0.115 66)"
  light-negative: "oklch(0.53 0.18 27)"
typography:
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, system-ui, sans-serif"
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
  md: "4.8px"
  lg: "6px"
  xl: "8.4px"
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
    rounded: "{rounded.lg}"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  panel:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.xl}"
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
---

# Design System: Job Tracker

## 1. Overview

**Creative North Star: "The Precision Instrument"**

A tool one engineer uses every day, usually in a dark room, to move job leads into submitted applications. It should read like a well-made instrument panel: an absolute-black display inside a graphite chassis, hairline structure, numbers set in a monospaced data face, and color that appears only when it means something. Nothing is decorative. Hierarchy comes from weight, size, spacing and three text tiers, not from tinted boxes.

The system is monochrome with two themes. Dark is the default and is designed first: content on `#000`, frame, sidebar, controls and popovers in graphite grays. Light mirrors it: content on white inside a light-gray frame. The user picks Sistema / Claro / Escuro (sidebar footer, or the Aparência panel in Perfil); the choice is stored per device and applied before first paint. The primary action is an inverted button (white on dark, black on light), used once per view. Status is a 6px dot next to a quiet label. Lists are dense rows divided by hairlines, not card grids. Density is deliberate: 14px UI text, 32px controls, 14px row padding.

It rejects, by name (from PRODUCT.md): generic SaaS dashboards (gray card grids, hero metrics, blue primary buttons, identical card columns, "enterprise" roundedness); recruitment-platform UIs (Greenhouse, LinkedIn, Indeed, dense HR tables); and gradient-heavy, animation-first portfolio tools.

**Key Characteristics:**
- Monochrome in two themes; depth by lightness steps, never by decorative shadow.
- One inverted primary button per view; everything else outline or ghost.
- Semantic color (positive / caution / negative) only for state, desaturated.
- Geist for UI, Geist Mono (`font-data`) for every number, date, score, count.
- Hairline dividers (`border-border`), rows over cards, panels over boxes-in-boxes.
- Sentence case everywhere. No uppercase tracked eyebrows.

## 2. Colors: The Graphite Palette

Pure neutral grays (chroma 0) in both themes. The only hues are three desaturated semantic states, tuned per theme to keep 4.5:1 as text.

### Neutral roles (dark / light)
- **Canvas** (`--canvas`, #141414 / #f5f5f5): app frame behind the content panel, sidebar, mobile tab bar, segmented-control track, log wells. The gray "chassis".
- **Background** (`--background`, #000000 / #ffffff): the content panel and every page surface. Panels and cards use this same value plus a border.
- **Surface** (`--surface`, #0f0f0f / #f6f6f6): row hover, table-header fills, empty-state icon tiles.
- **Popover** (`--popover`, #161616 / #ffffff): dialogs, sheets, menus, tooltips, toasts.
- **Field** (`--field`, #090909 / #ffffff): input, select and textarea fills.
- **Muted / Accent** (`--muted`, `--accent`): skeletons, code, selected segment, menu-item hover.
- **Border** (`--border`, #252525 / #e6e6e6): every hairline divider and panel outline.
- **Border Strong** (`--border-strong` / `--input`, #363636 / #d4d4d4): input and outline-button strokes.
- **Foreground** (#eeeeee / #121212): primary text, titles, values. ~18:1 on background.
- **Muted Foreground** (#a4a4a4 / #525252): secondary text, descriptions, meta, prose. ≥6.2:1 everywhere.
- **Subtle Foreground** (#8c8c8c / #696969): tertiary text: timestamps, separators, placeholders, field labels in `dl`. ≥4.6:1 on every surface; it is the floor. Never go dimmer with alpha.

### Semantic (state only)
- **Positive** (dark oklch(0.79 0.12 158) / light oklch(0.5 0.12 155)): good outcomes: interesting lead, offer, approved, rising delta.
- **Caution** (dark oklch(0.83 0.11 82) / light oklch(0.545 0.115 66)): needs a decision: review, stale backlog, mismatch warnings.
- **Negative** (dark oklch(0.72 0.14 24) / light oklch(0.53 0.18 27)): bad outcomes and destructive actions: rejected, blacklist, failures, falling delta.
- Positive and caution are too close for color-blind readers when adjacent in a chart: keep a neutral segment between them (see the classification bar).

### Charts
`--chart-1` (most prominent) to `--chart-5` (least): light-on-dark ramp in dark, dark-on-light in light. `--chart-4` is the dimmest step that still reaches 3:1 on the background; `--chart-5` is decorative only.

### Named Rules
**The No-Accent Rule.** There is no brand hue. The primary button is the inverted neutral (white on dark, black on light). Never introduce blue, violet, sky, emerald, amber or any Tailwind palette color (`emerald-400`, `sky-400/8`, `zinc-500`...). Only the tokens above, and never a literal `bg-black`, `text-white`, `shadow-black/*`, hex or oklch in components: both themes must work from the same class names.

**The Meaning-Only Rule.** Color appears only on the dot, number or word that carries the state. Never tint a container background or border to signal a category.

**The Floor Rule.** `subtle-foreground` is the dimmest legal text. `text-muted-foreground/60`, `text-foreground/40` and similar alpha text are banned.

## 3. Typography

**UI Font:** Geist (`font-sans`, `--font-geist-sans`)
**Data Font:** Geist Mono (`font-data` utility: mono + tabular + slashed zero)

**Character:** One neutral grotesque carries every word; the mono face marks anything countable, so numbers scan as a column and the tool reads as engineered.

### Hierarchy
- **Headline** (600, 24px / `text-2xl`, 20px on phones, tracking -0.015em): page titles, via `PageHeader` only.
- **Title** (500, 15px / `text-[15px]`): row titles, entity names in lists, dialog titles use 18-20px semibold.
- **Section** (500, 14px / `text-sm font-medium text-foreground`): panel headings, form sections. Sentence case.
- **Body** (400, 14px / `text-sm`, line-height 1.5-1.7): UI text and prose. Long prose (job descriptions, notes) is capped at `max-w-[68ch]`.
- **Meta** (400, 13px / `text-[13px] text-muted-foreground`): company, seniority, location, descriptions.
- **Label** (500, 12px / `text-xs`): status labels, field labels (`text-subtle-foreground`), table headers (`text-muted-foreground`).
- **Data** (`font-data`, 12-15px; KPI values 24-28px `font-medium`): scores, counts, dates, deltas, percentages, IDs.

### Named Rules
**The Data-Face Rule.** Every number a user compares (score, count, date, percent, delta, N) is set in `font-data`. Words stay in Geist.

**The No-Eyebrow Rule.** Never `text-[11px] uppercase tracking-[0.18em]` labels above sections or in stat tiles. Use a sentence-case Section heading.

## 4. Elevation

Flat by default. Depth is tonal: in dark, black content sits inside a lighter graphite frame and floating layers get lighter still; in light, white content sits inside a light-gray frame. Panels are outlined with a 1px `border-border`, never shadowed. Shadows exist only on floating layers, through theme tokens: menus and tooltips use `shadow-popover`, dialogs and sheets use `shadow-overlay`. Modal backdrops use `bg-overlay` (black at 70% in dark, 40% in light), with no blur.

### Named Rules
**The Hairline Rule.** Structure is drawn with 1px lines in `border-border`. No double borders (a bordered panel inside a bordered panel), no side stripes, no nested cards.

## 5. Components

Primitives live in `src/components/ui/`. Use them; never restyle their height or radius at the call site.

### Buttons (`Button`, `buttonVariants`)
- **Shape:** `rounded-lg` (6px). Sizes: `sm` 28px, `default` 32px, `lg` 36px; touch pointers get +8px automatically.
- **Primary (`default`):** white `bg-primary`, dark text, `hover:bg-primary-hover`. One per view: the page-level action (Rodar radar, Nova candidatura, Salvar).
- **Outline:** `border-border-strong`, foreground text, `hover:bg-accent`. Row-level main action (Aprovar, Criar candidatura), secondary page actions.
- **Ghost:** muted text, `hover:bg-accent hover:text-foreground`. Tertiary: Descartar, Editar, icon buttons, close.
- **Destructive:** `bg-destructive/12 text-destructive`.
- **Focus:** `ring-2 ring-ring`. **Disabled:** 40% opacity. Pending labels end with an ellipsis: "Salvando…".
- Don't pass `h-10`, `h-11`, `rounded-xl`, `px-5` overrides. Don't use a `brand` variant (it was removed).

### Status (`Status`, `StatusDot` in `ui/status.tsx`)
6px dot + 12px medium label in `muted-foreground`. Tones:
- Leads: interesting `positive`, review `caution`, discarded `muted`.
- Applications: applied `neutral`, in_process `active`, offer `positive`, approved `positive`, rejected `negative`, withdrawn `muted`.
- Companies: monitoring `neutral`, in_process `active`, discarded `muted`, blacklist `negative`.
- Live state (radar running): `StatusDot tone="active" pulse`.

### Chips (`Chip`)
Rarely needed. 20px tall, `rounded-md`, 1px border, 12px text. Prefer a plain meta line instead: items joined by `<span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>`.

### Panels and lists
- **Panel primitives** (`ui/panel.tsx`): `Panel` (outlined section), `PanelHeader` (44px bar, hairline below), `PanelTitle` (Section heading), `PanelMeta` (right side: count, period, quiet link), `PanelBody` (`p-4 sm:p-5`). Never nest a Panel in a Panel.
- **Notice** (`ui/notice.tsx`): `<Notice tone="caution">…</Notice>`; add `bordered` when it stands alone, `pulse` for in-progress states.
- **MetaLine** (`ui/meta-line.tsx`): `<MetaLine items={[company, seniority, model]} />`, falsy items skipped.
- **List panel:** `<section className="-mx-4 border-y border-border sm:mx-0 sm:rounded-xl sm:border-x">`, a header bar (`TabBar` or `flex h-11 items-center justify-between gap-3 border-b border-border px-4 sm:px-5`), then `<ul className="divide-y divide-border">`. Rows: `px-4 py-3.5 sm:px-5`, `hover:bg-surface`, whole row clickable through a stretched `absolute inset-0` button with row actions at `relative z-10`.
- **Panel:** `rounded-xl border border-border`; header `flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5` with a Section heading and optional `font-data text-xs text-subtle-foreground` meta; body `p-4 sm:p-5`.
- **Panel grid (dashboards):** `grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-2`, each cell `bg-background p-4 sm:p-5`. Shared hairlines instead of separate cards.
- **Metric strip:** one bordered `dl`, cells divided by hairlines; `dt` 13px `muted-foreground`, `dd` `font-data text-2xl font-medium`, optional delta `font-data text-xs text-positive|text-negative|text-subtle-foreground`. No icons, no tints.
- **Definition rows:** `dt text-xs text-subtle-foreground`, `dd text-sm text-foreground`; empty values read "Não informado" in `subtle-foreground`.
- **Inline notice** (replaces tinted alert boxes): `flex items-start gap-2 text-[13px] text-muted-foreground` with `<StatusDot tone="caution|negative" className="mt-[7px]" />`. Optionally inside `rounded-lg border border-border px-3 py-2.5`.

### Tabs and toggles
- **TabBar / TabBarItem** (`ui/tab-bar.tsx`): underlined view tabs heading a list panel; count in `font-data`; active tab gets a 1px foreground rule.
- **SegmentedControl / SegmentedControlItem** (`ui/segmented-control.tsx`): single-choice filters (period, classification); canvas track, `bg-accent` selected segment.

### Inputs / Fields
- **Style:** `Input`, `Textarea`, `SelectTrigger`, `NativeSelect` (native `<select>` for uncontrolled forms and phone pickers): 32px, `rounded-lg`, `border-input`, `bg-field`, placeholder `subtle-foreground`.
- **Focus:** `border-ring` + `ring-2 ring-ring/25`. **Error:** `aria-invalid` → destructive border and ring.
- Labels 13px medium foreground; descriptions 13px `muted-foreground`. Group with `FieldSet` + `FieldLegend` (14px semibold) and hairline separators between sections.

### Dialogs and sheets
`bg-popover`, `border-border`, `rounded-xl`, header and footer separated by hairlines, body in `ScrollArea` (`min-h-0 flex-1`). Phones get the draggable bottom sheet automatically.

### Empty states
`Empty` inside the panel that would hold the content: bordered icon tile (`EmptyMedia variant="icon"`), 14px title, 13px description that teaches the next step, one outline action.

### Navigation
Sidebar on canvas: the `jt` monogram (`public/brand/jt-mark.png`, drawn through a CSS mask on `bg-foreground`, so it follows the theme) + `job-tracker` in the data face; 32px items, 16px icons in `subtle-foreground`, active item `bg-sidebar-accent` + foreground. Radar-running row appears in the footer with a pulsing dot and `font-data` progress. Footer: theme picker (`ThemeToggle`, icons only; `ThemeCycleButton` when the sidebar is collapsed) next to the collapse trigger. Phones: bottom tab bar on canvas; active tab gets a 1px foreground rule on the bar's top edge; the theme picker lives in Perfil → Aparência.

### Theme
`src/lib/theme.ts` holds the preference type, storage key and the inline `<head>` script that sets `light`/`dark` on `<html>` before paint. `src/hooks/use-theme.ts` exposes `useThemePreference`, `useResolvedTheme` and `setThemePreference` (disables transitions during the swap, syncs across tabs and with the OS when set to Sistema). Default for a new device: dark.

### Brand mark
`public/brand/jt-monogram.png` (1024px, black on transparent) is the source. `jt-mark.png` is the trimmed mask. App icons (`src/app/icon.png`, `apple-icon.png`, `favicon.ico`) put the white glyph on a graphite tile so it reads on light and dark tab bars.

### Charts
Monochrome ramp `--chart-1` (lightest) to `--chart-5`; semantic tokens only for status series (interesting/review/discarded). Hairline grid in `var(--border)`, ticks in `font-data` 10-11px `subtle-foreground`, tooltip on `popover` with `border`. Prefer bars and stacked bars over pies.

## 6. Do's and Don'ts

### Do:
- **Do** use one white primary button per view and make row actions outline or ghost.
- **Do** set every number in `font-data` (Geist Mono, tabular, slashed zero).
- **Do** show state as `Status` dot + label; color the dot, not the container.
- **Do** build lists as hairline-divided rows inside one panel, with the whole row clickable.
- **Do** keep page descriptions to real information: "8 na triagem · 2 aprovados", not restated titles.
- **Do** respect `prefers-reduced-motion`; motion is 150-200ms, `ease-out-quart`, state changes only.
- **Do** keep text at or above `subtle-foreground` (4.5:1) and prose under 68ch.

### Don't:
- **Don't** build generic SaaS dashboards: gray card grids, hero metrics, blue primary buttons, identical card columns, "enterprise" roundedness.
- **Don't** reproduce recruitment-platform UI (Greenhouse, LinkedIn, Indeed) or dense HR-department tables.
- **Don't** add gradients, glows, glassmorphism, `backdrop-blur`, gradient text or animated shine.
- **Don't** assume a theme: no `bg-black/*`, `text-white`, `shadow-black/*`, `rgba(...)`, hex or oklch in components; use tokens (`bg-overlay`, `shadow-popover`, `shadow-overlay`, `var(--chart-3)`).
- **Don't** use colored stat tiles (`border-sky-400/20 bg-sky-400/8` and friends) or tinted alert boxes.
- **Don't** use uppercase tracked eyebrows (`text-[11px] uppercase tracking-[0.18em]`).
- **Don't** use `rounded-2xl`, `rounded-3xl` or pills on containers; panels are `rounded-xl`, controls `rounded-lg`.
- **Don't** use `border-left`/`border-right` wider than 1px as an accent stripe.
- **Don't** nest cards or put a bordered box inside a bordered panel.
- **Don't** use em dashes in copy; use a period, colon or parentheses.
