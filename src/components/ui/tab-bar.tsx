import { cn } from "@/lib/utils";

/**
 * Underlined view tabs that head a list panel. The active tab gets a 2px
 * foreground rule sitting on the bar's bottom border.
 */
function TabBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="tablist"
      data-slot="tab-bar"
      className={cn(
        "relative flex min-w-0 snap-x items-stretch overflow-x-auto border-b border-border scrollbar-none",
        className,
      )}
      {...props}
    />
  );
}

function TabBarItem({
  selected,
  count,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type" | "role"> & {
  selected: boolean;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      data-slot="tab-bar-item"
      className={cn(
        "group/tab relative flex h-11 shrink-0 snap-start items-center gap-2 px-3 text-sm font-medium whitespace-nowrap text-subtle-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:bg-accent aria-selected:text-foreground",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors after:duration-150 aria-selected:after:bg-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="font-data text-xs text-subtle-foreground group-aria-selected/tab:text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export { TabBar, TabBarItem };
