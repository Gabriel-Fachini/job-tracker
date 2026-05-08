import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { CompanyRow } from "@/server/queries/dashboard";

interface TopCompaniesWidgetProps {
  rows: CompanyRow[];
}

export function TopCompaniesWidget({ rows }: TopCompaniesWidgetProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Top empresas
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

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Top empresas
      </h3>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30">
              <th className="pb-2 text-left font-medium text-muted-foreground/60">
                Empresa
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                Leads
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                % inter.
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                Score
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                Apps
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                Sinal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {rows.map((row) => {
              const isUnproductive =
                row.leads >= 5 && row.interestingPct === 0;
              const isHighQuality =
                row.leads >= 3 && row.interestingPct >= 50;

              return (
                <tr
                  key={row.id}
                  className="group transition-colors hover:bg-white/3"
                >
                  <td className="py-2 pr-3">
                    <Link
                      href={`/leads?company=${row.id}`}
                      className="font-medium text-foreground/90 hover:text-foreground"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right tabular-nums text-foreground/80">
                    {row.leads}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    <span
                      className={
                        row.interestingPct === 0
                          ? "text-rose-400/70"
                          : row.interestingPct >= 50
                            ? "text-emerald-400"
                            : "text-muted-foreground/60"
                      }
                    >
                      {row.interestingPct}%
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground/60">
                    {row.avgScore ?? "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground/60">
                    {row.apps > 0 ? (
                      <span className="text-emerald-400">{row.apps}</span>
                    ) : (
                      row.apps
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {isUnproductive && (
                      <span
                        title="Muitos leads, 0% interessante — considere pausar"
                        className="inline-flex items-center gap-0.5 text-rose-400/80"
                      >
                        <TrendingDown className="size-3" />
                        <span className="text-[10px]">pausar</span>
                      </span>
                    )}
                    {isHighQuality && (
                      <span
                        title="Alta taxa de interessantes — priorize"
                        className="inline-flex items-center gap-0.5 text-emerald-400"
                      >
                        <TrendingUp className="size-3" />
                        <span className="text-[10px]">priorizar</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
