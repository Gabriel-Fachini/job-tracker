import { AlertCircle } from "lucide-react";

import type { WorkModelMatchData } from "@/server/queries/dashboard";

const LABELS: Record<string, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};

const COLORS: Record<string, string> = {
  remote: "bg-emerald-500/60",
  hybrid: "bg-amber-500/60",
  onsite: "bg-rose-500/60",
};

interface WorkModelWidgetProps {
  data: WorkModelMatchData;
}

export function WorkModelWidget({ data }: WorkModelWidgetProps) {
  const { preference, leadsDist, nullCount, total } = data;
  const knownTotal = leadsDist.reduce((s, r) => s + r.count, 0);

  const topModel = leadsDist[0]?.workModel ?? null;
  const hasMismatch =
    preference && topModel && preference !== topModel && knownTotal >= 3;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Match de preferências
      </h3>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="text-sm text-muted-foreground">Dados insuficientes</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Preference badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preferência:</span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                preference
                  ? `${COLORS[preference] ?? "bg-slate-500/60"} text-foreground`
                  : "bg-border/40 text-muted-foreground"
              }`}
            >
              {preference ? (LABELS[preference] ?? preference) : "Não definida"}
            </span>
          </div>

          {/* Distribution */}
          {knownTotal === 0 ? (
            <p className="text-xs text-muted-foreground/60">
              Nenhum lead com work model definido no período ({nullCount} sem
              dado).
            </p>
          ) : (
            <div className="space-y-2">
              {leadsDist.map((row) => {
                const pct = Math.round((row.count / knownTotal) * 100);
                const isMatch = row.workModel === preference;
                return (
                  <div key={row.workModel} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {LABELS[row.workModel] ?? row.workModel}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-4 flex-1 overflow-hidden rounded bg-white/5">
                        <div
                          className={`h-full rounded ${COLORS[row.workModel] ?? "bg-slate-500/60"} ${isMatch ? "ring-1 ring-emerald-400/40" : ""}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs tabular-nums text-foreground/80">
                        {row.count}
                      </span>
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground/50">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {nullCount > 0 && (
                <p className="text-[10px] text-muted-foreground/40">
                  + {nullCount} leads sem work model informado
                </p>
              )}
            </div>
          )}

          {hasMismatch && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300/90">
                Maioria dos leads é{" "}
                <strong>{LABELS[topModel] ?? topModel}</strong> mas preferência
                é <strong>{LABELS[preference] ?? preference}</strong> — empresas
                monitoradas podem estar erradas.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
