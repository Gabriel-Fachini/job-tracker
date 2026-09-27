import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Small metadata tag (seniority, work model, score...). Monochrome by default;
 * `positive`/`caution` are reserved for judgements, never for decoration.
 */
const chipVariants = cva(
  "inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-md border px-1.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border text-muted-foreground",
        positive: "border-positive/25 text-positive",
        caution: "border-caution/25 text-caution",
        info: "border-border text-muted-foreground",
        muted: "border-transparent px-0 text-subtle-foreground",
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
