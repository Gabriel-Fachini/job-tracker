import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Small metadata pill (seniority, work model, score...). Color is reserved for
 * meaning: `positive`/`caution` for judgements, `neutral` for plain facts.
 */
const chipVariants = cva(
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-5 font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-foreground/[0.04] text-foreground/75",
        positive: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        caution: "border-amber-400/25 bg-amber-400/10 text-amber-200",
        info: "border-sky-400/20 bg-sky-400/8 text-sky-200",
        muted: "border-border/70 bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

function Chip({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return (
    <span
      data-slot="chip"
      className={cn(chipVariants({ tone }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
