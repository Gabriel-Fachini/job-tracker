import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  /** One line of real information (counts, dates), not a restated title. */
  description?: React.ReactNode;
  /** Kept on the title row on phones, so keep them compact. */
  actions?: React.ReactNode;
  /** `stacked` moves actions to their own full-width row on phones. */
  actionsPlacement?: "inline" | "stacked";
  /** Rendered above the title, e.g. the back link on detail pages. */
  leading?: React.ReactNode;
  className?: string;
};

function toAreas(rows: string[]) {
  return rows.map((row) => `"${row}"`).join(" ");
}

export function PageHeader({
  title,
  description,
  actions,
  actionsPlacement = "inline",
  leading,
  className,
}: PageHeaderProps) {
  const hasActions = Boolean(actions);
  const stacked = hasActions && actionsPlacement === "stacked";

  // Only rows that exist get a track, so empty rows never add gap.
  const base: string[] = [];
  const wide: string[] = [];
  if (leading) {
    base.push("lead lead");
    wide.push("lead lead");
  }
  if (!hasActions) {
    base.push("title title");
    wide.push("title title");
  } else {
    base.push(stacked ? "title title" : "title actions");
    wide.push("title actions");
  }
  if (description) {
    base.push("desc desc");
    wide.push(hasActions ? "desc actions" : "desc desc");
  }
  if (stacked) {
    base.push("actions actions");
  }

  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-border pb-4 [grid-template-areas:var(--header-areas)] sm:gap-x-6 sm:pb-5 sm:[grid-template-areas:var(--header-areas-wide)]",
        className,
      )}
      style={
        {
          "--header-areas": toAreas(base),
          "--header-areas-wide": toAreas(wide),
        } as React.CSSProperties
      }
    >
      {leading ? <div className="mb-2 [grid-area:lead]">{leading}</div> : null}
      <h1 className="min-w-0 font-heading text-xl leading-tight font-semibold tracking-[-0.015em] text-balance break-words text-foreground [grid-area:title] sm:text-2xl">
        {title}
      </h1>
      {description ? (
        <p className="min-w-0 text-[13px] text-pretty text-muted-foreground [grid-area:desc]">
          {description}
        </p>
      ) : null}
      {actions ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-end gap-2 [grid-area:actions] sm:self-end",
            // Inline actions share the title row on phones: wrap instead of crushing the title.
            stacked ? "mt-3 justify-start sm:mt-0 sm:justify-end" : "max-sm:max-w-[calc(100vw-9rem)]",
          )}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
