import { Delta } from "@/components/glassdoor/delta";
import { formatRating } from "@/components/glassdoor/format";
import type { GlassdoorView } from "@/lib/glassdoor/view";

/**
 * Average review rating per year (columns) with the company's overall rating
 * as a dashed reference. Computed from the stored reviews, so it works from the
 * first import, before there is a history of snapshots.
 */
export function TrendChart({
  trend,
  overall,
}: {
  trend: GlassdoorView["trend"];
  overall: number | null;
}) {
  if (trend.years.length === 0) {
    return (
      <p className="text-[13px] text-subtle-foreground">
        Sem avaliações importadas para calcular a tendência.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h3 className="text-xs font-medium text-subtle-foreground">
            Nota média das avaliações por ano
          </h3>
          <p className="mt-1 text-xs text-subtle-foreground">
            Calculada a partir das <span className="font-data">{trend.sample}</span>{" "}
            avaliações importadas.
            {overall !== null ? (
              <>
                {" "}
                Linha tracejada = nota geral (<span className="font-data">{formatRating(overall)}</span>).
              </>
            ) : null}
          </p>
        </div>
        {trend.last12 ? (
          <div className="text-right">
            <p className="font-data text-xl leading-none font-semibold text-foreground">
              {formatRating(trend.last12.average)}
            </p>
            <p className="mt-1 text-xs text-subtle-foreground">
              últimos 12 meses (<span className="font-data">{trend.last12.count}</span>)
            </p>
            <Delta
              current={trend.last12.average}
              reference={overall}
              label="vs geral"
              className="block"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 overflow-x-auto pt-5">
        <div className="flex h-44 min-w-[18rem] flex-col">
          <div className="relative flex-1">
            {[1, 2, 3, 4, 5].map((tick) => (
              <div
                key={tick}
                aria-hidden
                className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2"
                style={{ bottom: `${(tick / 5) * 100}%` }}
              >
                <span className="w-3 text-right font-data text-[10px] text-subtle-foreground">
                  {tick}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ))}

            <ol className="absolute inset-y-0 right-0 left-5 flex gap-2">
              {trend.years.map((point) => (
                <li
                  key={point.year}
                  className="relative min-w-0 flex-1"
                  title={`${point.year}: nota ${formatRating(point.average)} em ${point.count} avaliações`}
                >
                  <span
                    className="absolute bottom-0 left-1/2 w-3/5 max-w-8 -translate-x-1/2 rounded-t-xs bg-chart-3"
                    style={{ height: `${(point.average / 5) * 100}%` }}
                  />
                  <span
                    className="absolute left-1/2 -translate-x-1/2 pb-0.5 font-data text-[11px] text-foreground"
                    style={{ bottom: `${(point.average / 5) * 100}%` }}
                  >
                    {formatRating(point.average)}
                  </span>
                </li>
              ))}
            </ol>

            {overall !== null ? (
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 left-5 border-t border-dashed border-foreground/50"
                style={{ bottom: `${(overall / 5) * 100}%` }}
              />
            ) : null}
          </div>

          <ol className="flex h-10 gap-2 pl-5">
            {trend.years.map((point) => (
              <li key={point.year} className="min-w-0 flex-1 pt-1.5 text-center">
                <p className="font-data text-[11px] text-muted-foreground">{point.year}</p>
                <p className="font-data text-[10px] text-subtle-foreground">n={point.count}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="sr-only">
        {trend.years.map((p) => `${p.year}: ${formatRating(p.average)}`).join("; ")}
      </p>
    </div>
  );
}
