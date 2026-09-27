import { cn } from "@/lib/utils";

/**
 * Compact single-choice toggle group (period, classification...). Items are
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
        "inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg border border-border bg-canvas p-0.5 pointer-coarse:h-10",
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
        "group/segment inline-flex h-full min-w-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="font-data text-xs text-subtle-foreground group-aria-pressed/segment:text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export { SegmentedControl, SegmentedControlItem };
