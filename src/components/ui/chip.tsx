import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Small metadata tag (skills, seniority, work model...): a gray Notion select
 * tag by default. `positive`/`caution`/`info` tint it for judgements only.
 * For workflow state use `Tag variant="status"`.
 */
const chipVariants = cva(
  "inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-sm border border-transparent px-1.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-tag-gray text-tag-gray-foreground",
        positive: "bg-tag-green text-tag-green-foreground",
        caution: "bg-tag-orange text-tag-orange-foreground",
        info: "bg-tag-blue text-tag-blue-foreground",
        muted: "px-0 text-subtle-foreground",
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
