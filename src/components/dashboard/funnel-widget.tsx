import Link from "next/link";

import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import type { FunnelData } from "@/server/queries/dashboard";

// Stages are ordered, so the fills step down the neutral ramp (validated as an
// ordinal ramp against the dark page surface).
const STAGES = [
  {
    key: "discovered" as keyof FunnelData,
    label: "Descobertos",
    fill: "bg-chart-1",
    href: "/leads",
  },
  {
    key: "interesting" as keyof FunnelData,
    label: "Interessantes",
    fill: "bg-chart-2",
    href: "/leads?status=interesting",
  },
  {
    key: "promoted" as keyof FunnelData,
    label: "Promovidos",
    fill: "bg-chart-3",
    href: "/leads?status=promoted",
  },
  {
    key: "applied" as keyof FunnelData,
    label: "Candidaturas",
    fill: "bg-chart-4",
    href: "/applications",
  },
];

function pct(n: number, total: number): string {
  if (total === 0) return "–";
  return `${Math.round((n / total) * 100)}%`;
}

interface FunnelWidgetProps {
  data: FunnelData;
}

export function FunnelWidget({ data }: FunnelWidgetProps) {
  const max = data.discovered || 1;
  const hasLowConversion =
    data.interesting > 0 && data.promoted / data.interesting < 0.5;

  return (
    <DashboardWidget
      title="Funil de topo"
      actual={data.discovered}
      insufficientDetail="Nenhum lead no período"
    >
      <ol className="flex flex-col">
        {STAGES.map((stage, i) => {
          const val = data[stage.key];
          const barWidth = Math.max(4, Math.round((val / max) * 100));
          const fromPrev = i === 0 ? null : pct(val, data[STAGES[i - 1].key]);

          return (
            <li key={stage.key}>
              {fromPrev !== null && (
                <p className="pl-[7.25rem] text-xs leading-5 text-subtle-foreground">
                  <span className="font-data">{fromPrev}</span> do estágio anterior
                </p>
              )}
              <Link
                href={stage.href}
                className="-mx-2 grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate text-[13px] text-muted-foreground">{stage.label}</span>
                <span aria-hidden className="h-1.5 overflow-hidden rounded-xs bg-muted">
                  <span
                    className={cn("block h-full rounded-xs", stage.fill)}
                    style={{ width: `${barWidth}%` }}
                  />
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="w-10 text-right font-data text-[13px] font-medium text-foreground">
                    {val}
                  </span>
                  <span className="w-9 text-right font-data text-xs text-subtle-foreground">
                    {pct(val, data.discovered)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {hasLowConversion && (
        <Notice tone="caution">
          Apenas{" "}
          <span className="font-data text-foreground">{pct(data.promoted, data.interesting)}</span>{" "}
          dos leads interessantes foram promovidos: há leads parados sem decisão.
        </Notice>
      )}
    </DashboardWidget>
  );
}
