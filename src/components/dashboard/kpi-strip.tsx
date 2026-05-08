import { Activity, FileText, Radar, Send } from "lucide-react";

import type { KpiData } from "@/server/queries/dashboard";

function delta(curr: number, prev: number | null): string | null {
  if (prev === null) return null;
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return "+∞";
  const pct = Math.round(((curr - prev) / prev) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function deltaClass(curr: number, prev: number | null): string {
  if (prev === null || prev === curr) return "text-muted-foreground/60";
  return curr >= prev ? "text-emerald-400" : "text-rose-400";
}

const CARDS = [
  {
    key: "leadsDiscovered" as keyof KpiData,
    label: "Leads descobertos",
    icon: Radar,
    colorClass: "border-sky-400/20 bg-sky-400/8",
    iconClass: "text-sky-300/80",
    textClass: "text-sky-100",
  },
  {
    key: "leadsReviewed" as keyof KpiData,
    label: "Leads revisados",
    icon: Activity,
    colorClass: "border-violet-400/20 bg-violet-400/8",
    iconClass: "text-violet-300/80",
    textClass: "text-violet-100",
  },
  {
    key: "appsCreated" as keyof KpiData,
    label: "Candidaturas",
    icon: Send,
    colorClass: "border-emerald-400/20 bg-emerald-400/8",
    iconClass: "text-emerald-300/80",
    textClass: "text-emerald-100",
  },
  {
    key: "resumesGenerated" as keyof KpiData,
    label: "Currículos gerados",
    icon: FileText,
    colorClass: "border-amber-400/20 bg-amber-400/8",
    iconClass: "text-amber-300/80",
    textClass: "text-amber-100",
  },
];

interface KpiStripProps {
  current: KpiData;
  previous: KpiData | null;
}

export function KpiStrip({ current, previous }: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, colorClass, iconClass, textClass }) => {
        const val = current[key];
        const prev = previous?.[key] ?? null;
        const d = delta(val, prev);
        const dc = deltaClass(val, prev);

        return (
          <div
            key={key}
            className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${colorClass}`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </p>
              <Icon className={`size-3.5 shrink-0 ${iconClass}`} />
            </div>
            <div className="mt-3 flex items-end gap-2">
              <p className={`text-3xl font-semibold tabular-nums ${textClass}`}>
                {val}
              </p>
              {d && (
                <p className={`mb-0.5 text-xs font-medium tabular-nums ${dc}`}>
                  {d}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
