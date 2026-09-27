import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import { Notice } from "@/components/ui/notice";
import { Status, type StatusTone } from "@/components/ui/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ClassifierQualityData } from "@/server/queries/dashboard";

const MIN_SAMPLES = 10;

function pct(n: number, d: number): string {
  if (d === 0) return "–";
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
  const healthy = !lowPrecision && !highFnRate && precision !== null;

  return (
    <DashboardWidget
      title="Qualidade do classifier"
      meta="Todo o período"
      minSamples={MIN_SAMPLES}
      actual={data.total}
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 sm:pl-5">Classifier</TableHead>
            <TableHead className="px-2 text-right sm:px-3">Decididos</TableHead>
            <TableHead className="px-2 text-right sm:px-3">Promovidos</TableHead>
            <TableHead className="pr-4 text-right sm:pr-5">Taxa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <QualityRow
            tone="positive"
            label="Interessante"
            decided={data.interestingTotal}
            promoted={data.interestingPromoted}
            rateClassName={cn("font-medium", lowPrecision ? "text-negative" : "text-positive")}
          />
          <QualityRow
            tone="caution"
            label="Revisar"
            decided={data.reviewTotal}
            promoted={data.reviewPromoted}
            rateClassName="text-muted-foreground"
          />
          <QualityRow
            tone="muted"
            label="Descartado"
            decided={data.discardedTotal}
            promoted={data.discardedOverridden}
            rateClassName={cn("font-medium", highFnRate ? "text-negative" : "text-muted-foreground")}
          />
        </TableBody>
      </Table>

      {lowPrecision || highFnRate || healthy ? (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3.5 sm:px-5">
          {lowPrecision && (
            <Notice tone="negative">
              Precisão baixa (
              <span className="font-data text-foreground">
                {pct(data.interestingPromoted, data.interestingTotal)}
              </span>
              ). Ajuste os critérios do prompt do classifier.
            </Notice>
          )}
          {highFnRate && (
            <Notice tone="caution">
              <span className="font-data text-foreground">
                {pct(data.discardedOverridden, data.discardedTotal)}
              </span>{" "}
              dos descartados foram revertidos: o classifier está perdendo leads bons.
            </Notice>
          )}
          {healthy && (
            <Notice tone="positive">Classifier operando bem com os dados atuais.</Notice>
          )}
        </div>
      ) : null}
    </DashboardWidget>
  );
}

function QualityRow({
  tone,
  label,
  decided,
  promoted,
  rateClassName,
}: {
  tone: StatusTone;
  label: string;
  decided: number;
  promoted: number;
  rateClassName: string;
}) {
  return (
    <TableRow>
      <TableCell className="pl-4 sm:pl-5">
        <Status tone={tone}>{label}</Status>
      </TableCell>
      <TableCell className="px-2 text-right font-data text-xs text-foreground sm:px-3">
        {decided}
      </TableCell>
      <TableCell className="px-2 text-right font-data text-xs text-foreground sm:px-3">
        {promoted}
      </TableCell>
      <TableCell className={cn("pr-4 text-right font-data text-xs sm:pr-5", rateClassName)}>
        {pct(promoted, decided)}
      </TableCell>
    </TableRow>
  );
}
