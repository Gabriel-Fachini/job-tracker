"use client";

import { AlertCircle } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimelineDay } from "@/server/queries/dashboard";

interface RadarTimelineWidgetProps {
  data: TimelineDay[];
}

const COLORS = {
  total: "#64748b",
  interesting: "#34d399",
};

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export function RadarTimelineWidget({ data }: RadarTimelineWidgetProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Atividade do radar
        </h3>
        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="text-sm text-muted-foreground">Dados insuficientes</p>
          <p className="text-xs text-muted-foreground/50">
            Nenhum lead no período
          </p>
        </div>
      </div>
    );
  }

  const zeroDays = data.filter((d) => d.total === 0).length;
  const hasGap = zeroDays > 0;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    total: Number(d.total),
    interesting: Number(d.interesting),
  }));

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Atividade do radar
      </h3>

      <div className="mt-4 h-48 min-w-0">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a2e",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) =>
                value === "total" ? "Total radar" : "Interessantes"
              }
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={COLORS.total}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="interesting"
              stroke={COLORS.interesting}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hasGap && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300/90">
            {zeroDays} dia{zeroDays > 1 ? "s" : ""} sem leads — radar pode não
            ter rodado ou ATS mudou.
          </p>
        </div>
      )}
    </div>
  );
}
