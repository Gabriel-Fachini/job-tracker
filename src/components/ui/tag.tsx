import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Property tag in the Notion style: a pastel tint with deep text of the same
 * hue. `status` (pill + dot) marks workflow state; `select` (4px corners) marks
 * a category. `muted` is outlined, for closed or inactive states.
 */
const tagVariants = cva(
  "inline-flex h-5 max-w-full min-w-0 shrink-0 items-center gap-1.5 border border-transparent text-xs font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      color: {
        gray: "bg-tag-gray text-tag-gray-foreground",
        orange: "bg-tag-orange text-tag-orange-foreground",
        green: "bg-tag-green text-tag-green-foreground",
        blue: "bg-tag-blue text-tag-blue-foreground",
        purple: "bg-tag-purple text-tag-purple-foreground",
        red: "bg-tag-red text-tag-red-foreground",
        muted: "border-border-strong text-subtle-foreground",
      },
      variant: {
        status: "rounded-full pr-2 pl-1.5",
        select: "rounded-sm px-1.5",
      },
    },
    defaultVariants: {
      color: "gray",
      variant: "select",
    },
  },
);

type TagColor = NonNullable<VariantProps<typeof tagVariants>["color"]>;

// Mid-tone dots: readable on the tag tint and on the plain page.
const tagDotVariants = cva("inline-block size-1.5 shrink-0 rounded-full", {
  variants: {
    color: {
      gray: "bg-muted-foreground",
      orange: "bg-caution",
      green: "bg-positive",
      blue: "bg-info",
      purple: "bg-primary dark:bg-ring",
      red: "bg-negative",
      muted: "ring-1 ring-subtle-foreground ring-inset",
    },
  },
  defaultVariants: {
    color: "gray",
  },
});

function TagDot({
  color,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "color"> & VariantProps<typeof tagDotVariants>) {
  return (
    <span
      aria-hidden
      data-slot="tag-dot"
      className={cn(tagDotVariants({ color }), className)}
      {...props}
    />
  );
}

function Tag({
  color,
  variant,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"span">, "color"> & VariantProps<typeof tagVariants>) {
  return (
    <span
      data-slot="tag"
      className={cn(tagVariants({ color, variant }), className)}
      {...props}
    >
      {variant === "status" ? <TagDot color={color} /> : null}
      {variant === "status" ? <span className="truncate">{children}</span> : children}
    </span>
  );
}

export { Tag, TagDot, tagVariants, type TagColor };
