"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartTooltip,
  DashboardWidget,
  chartTick,
} from "@/components/dashboard/dashboard-widget";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import type { ClassificationDist, ScoreBucket } from "@/server/queries/dashboard";

// Stack order is deliberate: the positive and caution tokens sit too close to
// tell apart side by side (dark palette: protanopia ΔE 5.4, normal vision
// 14.8), so the neutral "discarded" segment always separates them. The order
// stays safe in any theme; re-check the ΔE if the tokens change.
const SEGMENTS = [
  { key: "interesting", label: "Interessante", swatch: "bg-positive" },
  { key: "discarded", label: "Descartado", swatch: "bg-chart-4" },
  { key: "review", label: "Revisar", swatch: "bg-caution" },
] as const;

interface ClassificationWidgetProps {
  dist: ClassificationDist;
  histogram: ScoreBucket[];
}

export function ClassificationWidget({
  dist,
  histogram,
}: ClassificationWidgetProps) {
  const segments = SEGMENTS.map((segment) => ({
    ...segment,
    value: dist[segment.key],
    pct: dist.total > 0 ? Math.round((dist[segment.key] / dist.total) * 100) : 0,
  }));
  const scored = histogram.reduce((sum, bucket) => sum + bucket.count, 0);

  const tooManyDiscarded = dist.total > 5 && dist.discarded / dist.total > 0.7;
  const tooManyReview = dist.total > 5 && dist.review / dist.total > 0.5;

  return (
    <DashboardWidget
      title="Distribuição de classificação"
      meta={<span className="font-data">N={dist.total}</span>}
      actual={dist.total}
      insufficientDetail="Nenhum lead no período"
    >
      <div className="flex flex-col gap-3">
        {/* The legend below carries every value; the bar is its visual twin. */}
        <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-xs">
          {segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <div
                key={segment.key}
                title={`${segment.label}: ${segment.value} (${segment.pct}%)`}
                className={cn("h-full min-w-0.5", segment.swatch)}
                style={{ flexGrow: segment.value, flexBasis: 0 }}
              />
            ))}
        </div>

        <ul className="flex flex-col">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2.5 py-1">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-xs", segment.swatch)} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                {segment.label}
              </span>
              <span className="font-data text-[13px] font-medium text-foreground">
                {segment.value}
              </span>
              <span className="w-10 text-right font-data text-xs text-subtle-foreground">
                {segment.pct}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {histogram.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-medium text-muted-foreground">Distribuição de score</h3>
            <span className="font-data text-xs text-subtle-foreground">N={scored}</span>
          </div>
          <div className="h-28 min-w-0">
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <BarChart data={histogram} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="bucket"
                  tick={chartTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={8}
                />
                <YAxis
                  tick={chartTick}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface)" }}
                  isAnimationActive={false}
                  content={
                    <ChartTooltip
                      names={{ count: "Leads" }}
                      formatLabel={(label) => `Score ${label}`}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--chart-3)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {tooManyDiscarded && (
        <Notice tone="negative">
          <span className="font-data text-foreground">
            {Math.round((dist.discarded / dist.total) * 100)}%
          </span>{" "}
          dos leads foram descartados: as empresas monitoradas podem estar mal selecionadas.
        </Notice>
      )}
      {tooManyReview && (
        <Notice tone="caution">
          <span className="font-data text-foreground">
            {Math.round((dist.review / dist.total) * 100)}%
          </span>{" "}
          em revisão: os critérios do classifier podem estar vagos.
        </Notice>
      )}
    </DashboardWidget>
  );
}
