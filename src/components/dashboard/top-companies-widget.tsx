import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CompanyRow } from "@/server/queries/dashboard";

interface TopCompaniesWidgetProps {
  rows: CompanyRow[];
}

export function TopCompaniesWidget({ rows }: TopCompaniesWidgetProps) {
  // Container queries: Score and Apps show when the cell (not the viewport)
  // is wide enough, so the half-width desktop cell stays readable.
  return (
    <DashboardWidget
      title="Top empresas"
      actual={rows.length}
      insufficientDetail="Nenhum lead no período"
      flush
      className="@container"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 sm:pl-5">Empresa</TableHead>
            <TableHead className="px-2 text-right sm:px-3">Leads</TableHead>
            <TableHead className="px-2 text-right sm:px-3">% inter.</TableHead>
            <TableHead className="hidden text-right @md:table-cell">Score</TableHead>
            <TableHead className="hidden text-right @md:table-cell">Apps</TableHead>
            <TableHead className="pr-4 text-right sm:pr-5">Sinal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isUnproductive = row.leads >= 5 && row.interestingPct === 0;
            const isHighQuality = row.leads >= 3 && row.interestingPct >= 50;

            return (
              <TableRow key={row.id}>
                <TableCell className="pl-4 sm:pl-5">
                  <Link
                    href={`/leads?companyId=${row.id}`}
                    className="block max-w-[9.5rem] truncate rounded-sm text-[13px] font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring @md:max-w-[14rem]"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="px-2 text-right font-data text-xs text-foreground sm:px-3">
                  {row.leads}
                </TableCell>
                <TableCell
                  className={cn(
                    "px-2 text-right font-data text-xs sm:px-3",
                    row.interestingPct === 0
                      ? "text-negative"
                      : row.interestingPct >= 50
                        ? "text-positive"
                        : "text-muted-foreground",
                  )}
                >
                  {row.interestingPct}%
                </TableCell>
                <TableCell className="hidden text-right font-data text-xs text-muted-foreground @md:table-cell">
                  {row.avgScore ?? (
                    <span className="text-subtle-foreground">
                      <span aria-hidden>–</span>
                      <span className="sr-only">Sem score</span>
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "hidden text-right font-data text-xs @md:table-cell",
                    row.apps > 0 ? "text-positive" : "text-muted-foreground",
                  )}
                >
                  {row.apps}
                </TableCell>
                <TableCell className="pr-4 text-right sm:pr-5">
                  {isUnproductive && (
                    <span
                      title="Muitos leads e 0% interessantes: considere pausar"
                      className="inline-flex items-center gap-1 text-xs text-negative"
                    >
                      <TrendingDown aria-hidden className="size-3" />
                      pausar
                    </span>
                  )}
                  {isHighQuality && (
                    <span
                      title="Alta taxa de interessantes: priorize"
                      className="inline-flex items-center gap-1 text-xs text-positive"
                    >
                      <TrendingUp aria-hidden className="size-3" />
                      priorizar
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DashboardWidget>
  );
}
