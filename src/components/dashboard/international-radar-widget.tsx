import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import { defaultSources } from "@/lib/job-monitoring/sources/catalog";
import { getDiscardReasonLabel } from "@/lib/job-monitoring/triage/discard-reasons";
import { formatUsdAnnualBounds } from "@/lib/job-monitoring/triage/labels";
import type { InternationalRadarData } from "@/server/queries/international-radar";

const SOURCE_LABELS: Record<string, string> = {
  company: "Boards das empresas",
  other: "Outras origens",
  // ATS boards of the companies (`source_kind` = provider).
  ashby: "Ashby",
  lever: "Lever",
  greenhouse: "Greenhouse",
  gupy: "Gupy",
  inhire: "InHire",
  ...Object.fromEntries(defaultSources.map((source) => [source.kind, source.name])),
};

function BarList({
  rows,
  total,
}: {
  rows: Array<{ label: string; count: number }>;
  total: number;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] text-muted-foreground">{row.label}</span>
            <span className="font-data text-[13px] font-medium text-foreground">{row.count}</span>
          </div>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-xs bg-muted">
            <div
              className="h-full bg-chart-3"
              style={{ width: `${total > 0 ? Math.max(2, Math.round((row.count / total) * 100)) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function InternationalRadarWidget({
  data,
  className,
}: {
  data: InternationalRadarData;
  className?: string;
}) {
  const salary = formatUsdAnnualBounds(data.medianSalaryUsdAnnual, data.medianSalaryUsdAnnual);
  const discardTotal = data.discardReasons.reduce((sum, row) => sum + row.count, 0);

  return (
    <DashboardWidget
      title="Radar internacional"
      meta={<span className="font-data">N={data.total}</span>}
      actual={data.total}
      insufficientDetail="Nenhum lead triado no período"
      className={className}
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs text-subtle-foreground">Elegíveis</dt>
            <dd className="mt-1 font-data text-lg font-medium text-foreground">
              {data.eligiblePct === null ? "–" : `${data.eligiblePct}%`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-subtle-foreground">Mediana salarial (elegíveis)</dt>
            <dd className="mt-1 font-data text-lg font-medium text-foreground">{salary ?? "–"}</dd>
            {salary ? (
              <dd className="text-xs text-subtle-foreground">
                <span className="font-data">{data.salarySamples}</span> vagas com salário
              </dd>
            ) : null}
          </div>
        </dl>

        <div className="grid gap-5 sm:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-medium text-muted-foreground">Leads por fonte</h3>
            <BarList
              rows={data.bySource.map((row) => ({ label: SOURCE_LABELS[row.source] ?? row.source, count: row.count }))}
              total={data.total}
            />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-medium text-muted-foreground">Motivos de descarte</h3>
            {data.discardReasons.length > 0 ? (
              <BarList
                rows={data.discardReasons.map((row) => ({
                  label: getDiscardReasonLabel(row.reason) ?? row.reason,
                  count: row.count,
                }))}
                total={discardTotal}
              />
            ) : (
              <p className="text-[13px] text-subtle-foreground">Nenhum descarte no período.</p>
            )}
          </section>
        </div>
      </div>
    </DashboardWidget>
  );
}
