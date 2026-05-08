import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import type { BacklogData } from "@/server/queries/dashboard";

function formatAge(date: Date): string {
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const BUCKETS: { key: keyof BacklogData["buckets"]; label: string }[] = [
  { key: "lt24h", label: "<24h" },
  { key: "d1to3", label: "1-3d" },
  { key: "d3to7", label: "3-7d" },
  { key: "gt7d", label: ">7d" },
];

interface BacklogWidgetProps {
  data: BacklogData;
}

export function BacklogWidget({ data }: BacklogWidgetProps) {
  const { total, oldestDate, buckets } = data;
  const hasStale = buckets.gt7d > 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Backlog de leads
        </h3>
        <Link
          href="/leads"
          className="text-[11px] text-muted-foreground/60 underline-offset-2 hover:text-muted-foreground hover:underline"
        >
          Ver leads →
        </Link>
      </div>

      {total === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-sm text-emerald-400">Nenhum lead pendente</p>
          <p className="text-xs text-muted-foreground/50">Backlog limpo</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Summary row */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {total}
              </p>
              <p className="text-xs text-muted-foreground">pendentes</p>
            </div>
            {oldestDate && (
              <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-2">
                <Clock className="size-3 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">
                  mais antigo:{" "}
                  <span className="font-medium text-foreground">
                    {formatAge(oldestDate)}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Age buckets */}
          <div className="grid grid-cols-4 gap-2">
            {BUCKETS.map(({ key, label }) => {
              const n = buckets[key];
              const isStale = key === "gt7d" && n > 0;
              return (
                <div
                  key={key}
                  className={`rounded-xl border px-2 py-2.5 text-center ${
                    isStale
                      ? "border-rose-400/30 bg-rose-400/8"
                      : "border-border/40 bg-card/60"
                  }`}
                >
                  <p
                    className={`text-lg font-semibold tabular-nums ${isStale ? "text-rose-300" : "text-foreground"}`}
                  >
                    {n}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">{label}</p>
                </div>
              );
            })}
          </div>

          {/* Gap signal */}
          {hasStale && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/8 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
              <p className="text-xs text-rose-300/90">
                {buckets.gt7d} lead{buckets.gt7d > 1 ? "s" : ""} interessante
                {buckets.gt7d > 1 ? "s" : ""} parado
                {buckets.gt7d > 1 ? "s" : ""} há mais de 7d — revise critérios
                ou tome decisão.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
