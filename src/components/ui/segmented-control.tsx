import { cn } from "@/lib/utils";

/**
 * Compact single-choice toggle group (period, classification...) drawn as
 * Notion pill tabs: outlined pills, the pressed one filled with ink. Items are
 * plain buttons with `aria-pressed`, so the group reads as a set of toggles.
 */
function SegmentedControl({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="segmented-control"
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 pointer-coarse:h-9",
        className,
      )}
      {...props}
    />
  );
}

function SegmentedControlItem({
  pressed,
  count,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & {
  pressed: boolean;
  /** Optional tally shown after the label in the data face. */
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-slot="segmented-control-item"
      className={cn(
        "group/segment inline-flex h-full min-w-0 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="font-data text-xs text-subtle-foreground group-aria-pressed/segment:text-background/70">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export { SegmentedControl, SegmentedControlItem };
