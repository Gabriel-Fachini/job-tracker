import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * Plain metadata joined by middots ("Sênior · Remoto · São Paulo"). Falsy
 * items are skipped, so callers can pass optional fields directly.
 */
function MetaLine({
  items,
  className,
  ...props
}: Omit<React.ComponentProps<"p">, "children"> & {
  items: Array<React.ReactNode>;
}) {
  const visible = items.filter(
    (item) => item !== null && item !== undefined && item !== false && item !== "",
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <p
      data-slot="meta-line"
      className={cn("min-w-0 truncate text-[13px] text-muted-foreground", className)}
      {...props}
    >
      {visible.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden className="mx-1.5 text-subtle-foreground">
              ·
            </span>
          ) : null}
          {item}
        </Fragment>
      ))}
    </p>
  );
}

export { MetaLine };
