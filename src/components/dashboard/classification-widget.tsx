"use client";

import { AlertCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ClassificationDist, ScoreBucket } from "@/server/queries/dashboard";

const STATUS_COLORS = {
  interesting: "#34d399",
  review: "#fbbf24",
  discarded: "#f87171",
};

const STATUS_LABELS = {
  interesting: "Interessante",
  review: "Em revisão",
  discarded: "Descartado",
};

interface ClassificationWidgetProps {
  dist: ClassificationDist;
  histogram: ScoreBucket[];
}

export function ClassificationWidget({
  dist,
  histogram,
}: ClassificationWidgetProps) {
  if (dist.total === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Distribuição de classificação
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

  const pieData = (["interesting", "review", "discarded"] as const)
    .filter((k) => dist[k] > 0)
    .map((k) => ({
      name: STATUS_LABELS[k],
      value: dist[k],
      pct: Math.round((dist[k] / dist.total) * 100),
      color: STATUS_COLORS[k],
    }));

  const tooManyDiscarded = dist.total > 5 && dist.discarded / dist.total > 0.7;
  const tooManyReview = dist.total > 5 && dist.review / dist.total > 0.5;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Distribuição de classificação
      </h3>

      <div className="mt-4 flex gap-4">
        {/* Pie */}
        <div className="h-40 w-40 min-w-0 shrink-0">
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={56}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  `${value} (${pieData.find((d) => d.name === name)?.pct ?? 0}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + stats */}
        <div className="flex flex-1 flex-col justify-center gap-2">
          {pieData.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: d.color }}
              />
              <span className="flex-1 text-xs text-muted-foreground">
                {d.name}
              </span>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {d.value}
              </span>
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground/60">
                {d.pct}%
              </span>
            </div>
          ))}
          <p className="mt-1 text-[10px] text-muted-foreground/40">
            Total: {dist.total} leads
          </p>
        </div>
      </div>

      {/* Score histogram */}
      {histogram.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Score (distribuição)
          </p>
          <div className="h-24 min-w-0">
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <BarChart
                data={histogram}
                margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
              >
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#6b7280" }}
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
                />
                <Bar
                  dataKey="count"
                  fill="#6366f1"
                  opacity={0.8}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tooManyDiscarded && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/8 px-3 py-2.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
          <p className="text-xs text-rose-300/90">
            {Math.round((dist.discarded / dist.total) * 100)}% dos leads
            descartados — empresas monitoradas podem estar mal-selecionadas.
          </p>
        </div>
      )}
      {tooManyReview && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300/90">
            {Math.round((dist.review / dist.total) * 100)}% em revisão —
            critérios do classifier podem estar vagos.
          </p>
        </div>
      )}
    </div>
  );
}
