import type { TooltipContentProps } from "recharts";

import { PanelBody, PanelHeader, PanelMeta, PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

interface DashboardWidgetProps {
  title: string;
  /** Right side of the header: a count, a scope, or a quiet link. */
  meta?: React.ReactNode;
  /** Sample size behind the widget. Below `minSamples` the body is replaced by the insufficient-data state. */
  actual?: number;
  minSamples?: number;
  /** Detail under "Dados insuficientes". Defaults to the sample readout ("N=3, mínimo 10"). */
  insufficientDetail?: React.ReactNode;
  /** Drop the body padding so tables run edge to edge inside the cell. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * One cell of the dashboard panel grid: section heading bar, then the body.
 * The grid wrapper draws the shared hairlines, so the cell only paints the
 * page surface.
 */
export function DashboardWidget({
  title,
  meta,
  actual,
  minSamples = 1,
  insufficientDetail,
  flush = false,
  className,
  bodyClassName,
  children,
}: DashboardWidgetProps) {
  const insufficient = actual !== undefined && actual < minSamples;

  return (
    <section className={cn("flex min-w-0 flex-col bg-background", className)}>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {meta ? <PanelMeta>{meta}</PanelMeta> : null}
      </PanelHeader>
      {insufficient ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-10 text-center sm:px-5 sm:py-12">
          <p className="text-[13px] text-muted-foreground">Dados insuficientes</p>
          <p className="text-xs text-subtle-foreground">
            {insufficientDetail ?? (
              <span className="font-data">
                N={actual}, mínimo {minSamples}
              </span>
            )}
          </p>
        </div>
      ) : (
        <PanelBody
          className={cn(
            "flex flex-1 flex-col gap-4",
            flush && "gap-0 p-0 sm:p-0",
            bodyClassName,
          )}
        >
          {children}
        </PanelBody>
      )}
    </section>
  );
}

/** Axis ticks for every dashboard chart: data face, tertiary ink. */
export const chartTick = {
  fontSize: 11,
  fill: "var(--subtle-foreground)",
  fontFamily: "var(--font-geist-mono)",
};

type ChartTooltipProps = Partial<
  Pick<TooltipContentProps, "active" | "payload" | "label">
> & {
  /** Display names keyed by series `dataKey`. */
  names?: Record<string, string>;
  formatLabel?: (label: string | number) => React.ReactNode;
};

/**
 * Recharts tooltip body on the popover surface. Each row keys its series
 * with a short stroke of the series color; the text stays in text tokens and
 * the value (data face) is the strong element.
 */
export function ChartTooltip({ active, payload, label, names, formatLabel }: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="min-w-36 rounded-xl border border-border bg-popover px-3 py-2 font-sans text-xs whitespace-nowrap shadow-lg">
      {label !== undefined ? (
        <p className="mb-1.5 font-data text-subtle-foreground">
          {formatLabel ? formatLabel(label) : label}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? entry.name);

          return (
            <li key={key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-0.5 w-2.5 shrink-0 rounded-full"
                style={{ background: entry.color ?? entry.stroke ?? entry.fill }}
              />
              <span className="flex-1 text-muted-foreground">{names?.[key] ?? entry.name}</span>
              <span className="font-data font-medium text-foreground">{String(entry.value ?? "")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
