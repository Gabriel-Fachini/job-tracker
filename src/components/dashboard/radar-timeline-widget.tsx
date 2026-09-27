"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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
import type { TimelineDay } from "@/server/queries/dashboard";

interface RadarTimelineWidgetProps {
  data: TimelineDay[];
  className?: string;
}

// Emphasis: "interesting" is the story (same positive token it wears across
// the dashboard); the total is context in a recessive gray (chart-3 clears
// 3:1 on the dark page surface).
const SERIES = [
  { key: "total", label: "Total do radar", color: "var(--chart-3)", swatch: "bg-chart-3" },
  { key: "interesting", label: "Interessantes", color: "var(--positive)", swatch: "bg-positive" },
] as const;

const SERIES_NAMES = Object.fromEntries(SERIES.map((s) => [s.key, s.label]));

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export function RadarTimelineWidget({ data, className }: RadarTimelineWidgetProps) {
  const zeroDays = data.filter((d) => d.total === 0).length;
  const hasGap = zeroDays > 0;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    total: Number(d.total),
    interesting: Number(d.interesting),
  }));

  const totals = {
    total: chartData.reduce((sum, d) => sum + d.total, 0),
    interesting: chartData.reduce((sum, d) => sum + d.interesting, 0),
  };

  return (
    <DashboardWidget
      title="Atividade do radar"
      actual={data.length}
      insufficientDetail="Nenhum lead no período"
      className={className}
    >
      <ul aria-label="Legenda" className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span aria-hidden className={cn("h-0.5 w-3 rounded-full", series.swatch)} />
            {series.label}
            <span className="font-data text-xs font-medium text-foreground">
              {totals[series.key]}
            </span>
          </li>
        ))}
      </ul>

      <div className="h-48 min-w-0 lg:h-56">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={chartTick}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              minTickGap={24}
            />
            <YAxis
              tick={chartTick}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              isAnimationActive={false}
              content={<ChartTooltip names={SERIES_NAMES} />}
            />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                stroke={series.color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hasGap && (
        <Notice tone="caution">
          <span className="font-data text-foreground">{zeroDays}</span> dia{zeroDays > 1 ? "s" : ""}{" "}
          sem leads: o radar pode não ter rodado ou o ATS mudou.
        </Notice>
      )}
    </DashboardWidget>
  );
}
