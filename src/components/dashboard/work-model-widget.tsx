import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import type { WorkModelMatchData } from "@/server/queries/dashboard";

const LABELS: Record<string, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
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
    <DashboardWidget
      title="Match de preferências"
      actual={total}
      insufficientDetail="Nenhum lead no período"
    >
      <p className="text-[13px] text-muted-foreground">
        Preferência:{" "}
        {preference ? (
          <span className="text-foreground">{LABELS[preference] ?? preference}</span>
        ) : (
          <span className="text-subtle-foreground">Não definida</span>
        )}
      </p>

      {knownTotal === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Nenhum lead com work model definido no período (
          <span className="font-data">{nullCount}</span> sem dado).
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Emphasis: the preferred model is the bright bar, the rest stay recessive. */}
          <ul className="flex flex-col gap-1">
            {leadsDist.map((row) => {
              const pct = Math.round((row.count / knownTotal) * 100);
              const isMatch = row.workModel === preference;

              return (
                <li
                  key={row.workModel}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 py-1"
                >
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      isMatch ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {LABELS[row.workModel] ?? row.workModel}
                  </span>
                  <span aria-hidden className="h-1.5 overflow-hidden rounded-xs bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded-xs",
                        isMatch ? "bg-foreground" : "bg-chart-4",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="w-10 text-right font-data text-[13px] font-medium text-foreground">
                      {row.count}
                    </span>
                    <span className="w-9 text-right font-data text-xs text-subtle-foreground">
                      {pct}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {nullCount > 0 && (
            <p className="text-xs text-subtle-foreground">
              + <span className="font-data">{nullCount}</span> leads sem work model informado
            </p>
          )}
        </div>
      )}

      {hasMismatch && (
        <Notice tone="caution">
          A maioria dos leads é{" "}
          <span className="text-foreground">{LABELS[topModel] ?? topModel}</span>, mas a
          preferência é <span className="text-foreground">{LABELS[preference] ?? preference}</span>.
          As empresas monitoradas podem estar erradas.
        </Notice>
      )}
    </DashboardWidget>
  );
}
