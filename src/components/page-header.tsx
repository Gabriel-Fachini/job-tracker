import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Kept on the title row on phones, so keep them compact. */
  actions?: React.ReactNode;
  /** `stacked` moves actions to their own full-width row on phones. */
  actionsPlacement?: "inline" | "stacked";
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  actionsPlacement = "inline",
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:items-end sm:gap-x-6",
        className,
      )}
    >
      <h1 className="col-start-1 row-start-1 font-heading text-[1.75rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      {actions ? (
        <div
          className={cn(
            "flex items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-end",
            actionsPlacement === "stacked"
              ? "col-span-2 row-start-3 mt-2.5 sm:mt-0"
              : "col-start-2 row-start-1",
          )}
        >
          {actions}
        </div>
      ) : null}
      {description ? (
        <p className="col-span-2 row-start-2 max-w-2xl text-sm text-pretty text-muted-foreground sm:col-span-1 sm:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}
