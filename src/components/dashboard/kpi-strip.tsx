import { cn } from "@/lib/utils";
import type { KpiData } from "@/server/queries/dashboard";

function delta(curr: number, prev: number | null): string | null {
  if (prev === null) return null;
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return "+∞";
  const pct = Math.round(((curr - prev) / prev) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function deltaClass(curr: number, prev: number | null): string {
  if (prev === null || prev === curr) return "text-subtle-foreground";
  return curr >= prev ? "text-positive" : "text-negative";
}

const METRICS: { key: keyof KpiData; label: string }[] = [
  { key: "leadsDiscovered", label: "Leads descobertos" },
  { key: "leadsReviewed", label: "Leads revisados" },
  { key: "appsCreated", label: "Candidaturas" },
  { key: "resumesGenerated", label: "Currículos gerados" },
];

interface KpiStripProps {
  current: KpiData;
  previous: KpiData | null;
}

/** One bordered metric strip; the grid gap draws the hairlines between cells. */
export function KpiStrip({ current, previous }: KpiStripProps) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {METRICS.map(({ key, label }) => {
        const val = current[key];
        const prev = previous?.[key] ?? null;
        const d = delta(val, prev);

        return (
          <div key={key} className="flex min-w-0 flex-col gap-2 bg-background px-4 py-3.5 sm:px-5 sm:py-4">
            <dt className="truncate text-[13px] text-muted-foreground">{label}</dt>
            <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-data text-2xl leading-none font-medium text-foreground sm:text-[1.625rem]">
                {val}
              </span>
              {d ? (
                <span className={cn("font-data text-xs", deltaClass(val, prev))}>
                  {d}
                  <span className="sr-only"> em relação ao período anterior</span>
                </span>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
