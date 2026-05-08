import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

import type { FunnelData } from "@/server/queries/dashboard";

const STAGES = [
  {
    key: "discovered" as keyof FunnelData,
    label: "Descobertos",
    color: "bg-slate-500/60",
    href: "/leads",
  },
  {
    key: "interesting" as keyof FunnelData,
    label: "Interessantes",
    color: "bg-sky-500/60",
    href: "/leads?status=interesting",
  },
  {
    key: "promoted" as keyof FunnelData,
    label: "Promovidos",
    color: "bg-violet-500/60",
    href: "/leads?status=promoted",
  },
  {
    key: "applied" as keyof FunnelData,
    label: "Candidaturas",
    color: "bg-emerald-500/60",
    href: "/applications",
  },
];

function pct(n: number, total: number): string {
  if (total === 0) return "—";
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
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Funil de topo
      </h3>

      {data.discovered === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="text-sm text-muted-foreground">Dados insuficientes</p>
          <p className="text-xs text-muted-foreground/50">
            Nenhum lead no período
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {STAGES.map((stage, i) => {
            const val = data[stage.key];
            const barWidth = Math.max(4, Math.round((val / max) * 100));
            const fromPrev =
              i === 0 ? null : pct(val, data[STAGES[i - 1].key]);

            return (
              <div key={stage.key} className="group">
                {i > 0 && (
                  <div className="my-1 flex items-center gap-2 pl-2">
                    <ChevronRight className="size-3 text-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/40">
                      {fromPrev} do estágio anterior
                    </span>
                  </div>
                )}
                <Link
                  href={stage.href}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/4"
                >
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {stage.label}
                  </span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/5">
                      <div
                        className={`h-full rounded-md ${stage.color} transition-all`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">
                      {val}
                    </span>
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground/60">
                      {pct(val, data.discovered)}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}

          {hasLowConversion && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300/90">
                Apenas {pct(data.promoted, data.interesting)} dos leads
                interessantes foram promovidos — leads parados sem decisão.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
