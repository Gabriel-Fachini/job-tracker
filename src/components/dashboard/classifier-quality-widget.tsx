import { AlertCircle, CheckCircle } from "lucide-react";

import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import type { ClassifierQualityData } from "@/server/queries/dashboard";

const MIN_SAMPLES = 10;

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

interface ClassifierQualityWidgetProps {
  data: ClassifierQualityData;
}

export function ClassifierQualityWidget({ data }: ClassifierQualityWidgetProps) {
  const precision =
    data.interestingTotal > 0
      ? data.interestingPromoted / data.interestingTotal
      : null;
  const fnRate =
    data.discardedTotal > 0
      ? data.discardedOverridden / data.discardedTotal
      : null;

  const lowPrecision = precision !== null && precision < 0.5;
  const highFnRate = fnRate !== null && fnRate > 0.1;

  return (
    <DashboardWidget
      title="Qualidade do classifier"
      minSamples={MIN_SAMPLES}
      actual={data.total}
    >
      <div className="mt-4 space-y-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30">
              <th className="pb-2 text-left font-medium text-muted-foreground/60">
                Classifier
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                Decididos
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                Promovidos
              </th>
              <th className="pb-2 text-right font-medium text-muted-foreground/60">
                Taxa
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            <tr>
              <td className="py-2 text-emerald-400">Interesting</td>
              <td className="py-2 text-right tabular-nums text-foreground/80">
                {data.interestingTotal}
              </td>
              <td className="py-2 text-right tabular-nums text-foreground/80">
                {data.interestingPromoted}
              </td>
              <td
                className={`py-2 text-right tabular-nums font-medium ${lowPrecision ? "text-rose-400" : "text-emerald-400"}`}
              >
                {pct(data.interestingPromoted, data.interestingTotal)}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-amber-400">Review</td>
              <td className="py-2 text-right tabular-nums text-foreground/80">
                {data.reviewTotal}
              </td>
              <td className="py-2 text-right tabular-nums text-foreground/80">
                {data.reviewPromoted}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground/60">
                {pct(data.reviewPromoted, data.reviewTotal)}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-rose-400">Discarded</td>
              <td className="py-2 text-right tabular-nums text-foreground/80">
                {data.discardedTotal}
              </td>
              <td className="py-2 text-right tabular-nums text-foreground/80">
                {data.discardedOverridden}
              </td>
              <td
                className={`py-2 text-right tabular-nums font-medium ${highFnRate ? "text-rose-400" : "text-muted-foreground/60"}`}
              >
                {pct(data.discardedOverridden, data.discardedTotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {lowPrecision && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/8 px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
            <p className="text-xs text-rose-300/90">
              Precisão baixa ({pct(data.interestingPromoted, data.interestingTotal)}) — ajuste critérios do prompt do classifier.
            </p>
          </div>
        )}
        {highFnRate && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-300/90">
              {pct(data.discardedOverridden, data.discardedTotal)} dos descartados foram revertidos — classifier perdendo leads bons.
            </p>
          </div>
        )}
        {!lowPrecision && !highFnRate && precision !== null && (
          <div className="flex items-center gap-2 text-xs text-emerald-400/80">
            <CheckCircle className="size-3.5" />
            Classifier operando bem com os dados atuais.
          </div>
        )}
      </div>
    </DashboardWidget>
  );
}
