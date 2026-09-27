import { cn } from "@/lib/utils";

/**
 * Outlined container for a block of related content. Flat: same surface as
 * the page, a hairline border, sections split by hairlines. Never nest one
 * Panel inside another.
 */
function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn("min-w-0 rounded-xl border border-border", className)}
      {...props}
    />
  );
}

function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="panel-title"
      className={cn("min-w-0 truncate text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
}

/** Right side of a panel header: a count, a period, or a quiet link. */
function PanelMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-meta"
      className={cn(
        "flex shrink-0 items-center gap-2 text-xs text-subtle-foreground",
        className,
      )}
      {...props}
    />
  );
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="panel-body" className={cn("p-4 sm:p-5", className)} {...props} />
  );
}

export { Panel, PanelBody, PanelHeader, PanelMeta, PanelTitle };
