import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * State indicator: a 6px dot plus a label. The dot carries the meaning, the
 * label stays in secondary text so a column of statuses reads calmly.
 *
 * - `active`   in flight (blue, like a Notion "In progress")
 * - `neutral`  open, waiting
 * - `positive` good outcome
 * - `caution`  needs a decision
 * - `negative` bad outcome / blocked
 * - `muted`    closed, inactive (hollow dot)
 */
const statusDotVariants = cva("inline-block size-1.5 shrink-0 rounded-full", {
  variants: {
    tone: {
      active: "bg-info",
      neutral: "bg-muted-foreground",
      positive: "bg-positive",
      caution: "bg-caution",
      negative: "bg-negative",
      muted: "ring-1 ring-subtle-foreground ring-inset",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

type StatusTone = NonNullable<VariantProps<typeof statusDotVariants>["tone"]>;

function StatusDot({
  tone,
  pulse = false,
  className,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof statusDotVariants> & {
    /** Live state (e.g. radar running). Respects reduced motion. */
    pulse?: boolean;
  }) {
  return (
    <span
      aria-hidden
      data-slot="status-dot"
      className={cn(
        statusDotVariants({ tone }),
        pulse && "motion-safe:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

function Status({
  tone,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusDotVariants>) {
  return (
    <span
      data-slot="status"
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
      {...props}
    >
      <StatusDot tone={tone} />
      <span className="truncate">{children}</span>
    </span>
  );
}

export { Status, StatusDot, statusDotVariants, type StatusTone };
