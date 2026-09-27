import { StatusDot, type StatusTone } from "@/components/ui/status";
import { cn } from "@/lib/utils";

/**
 * One-line diagnostic or warning. The dot carries the tone; the text stays
 * readable secondary copy. Replaces tinted alert boxes.
 */
function Notice({
  tone = "neutral",
  pulse = false,
  bordered = false,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  tone?: StatusTone;
  /** Live, in-progress state (respects reduced motion). */
  pulse?: boolean;
  /** Frame it when it sits alone rather than inside a panel. */
  bordered?: boolean;
}) {
  return (
    <div
      role="note"
      data-slot="notice"
      className={cn(
        "flex items-start gap-2.5 text-[13px] leading-5 text-pretty text-muted-foreground",
        bordered && "rounded-lg border border-border px-3 py-2.5",
        className,
      )}
      {...props}
    >
      <StatusDot tone={tone} pulse={pulse} className="mt-[7px]" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export { Notice };
