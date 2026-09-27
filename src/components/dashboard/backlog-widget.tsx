import Link from "next/link";

import { DashboardWidget } from "@/components/dashboard/dashboard-widget";
import { MetaLine } from "@/components/ui/meta-line";
import { Notice } from "@/components/ui/notice";
import { StatusDot } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import type { BacklogData } from "@/server/queries/dashboard";

function formatAge(date: Date): string {
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const BUCKETS: { key: keyof BacklogData["buckets"]; label: string }[] = [
  { key: "lt24h", label: "<24h" },
  { key: "d1to3", label: "1-3d" },
  { key: "d3to7", label: "3-7d" },
  { key: "gt7d", label: ">7d" },
];

interface BacklogWidgetProps {
  data: BacklogData;
}

export function BacklogWidget({ data }: BacklogWidgetProps) {
  const { total, oldestDate, buckets } = data;
  const hasStale = buckets.gt7d > 0;
  const plural = buckets.gt7d > 1 ? "s" : "";

  return (
    <DashboardWidget
      title="Backlog de leads"
      meta={
        <Link
          href="/leads"
          className="-my-1 rounded-md px-1.5 py-1 font-medium text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver leads
        </Link>
      }
    >
      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="flex items-center gap-2 text-[13px] text-foreground">
            <StatusDot tone="positive" />
            Nenhum lead pendente
          </p>
          <p className="text-xs text-subtle-foreground">Backlog limpo</p>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-baseline gap-2.5">
            <span className="font-data text-[1.75rem] leading-none font-medium text-foreground">
              {total}
            </span>
            <MetaLine
              items={[
                "pendentes",
                oldestDate && (
                  <>
                    mais antigo{" "}
                    <span className="font-data text-foreground">{formatAge(oldestDate)}</span>
                  </>
                ),
              ]}
            />
          </div>

          <dl aria-label="Idade dos leads pendentes" className="grid grid-cols-4 divide-x divide-border">
            {BUCKETS.map(({ key, label }) => {
              const n = buckets[key];
              const isStale = key === "gt7d" && n > 0;

              return (
                <div key={key} className="flex min-w-0 flex-col gap-1 px-3 first:pl-0 last:pr-0">
                  <dt className="font-data text-xs text-subtle-foreground">{label}</dt>
                  <dd
                    className={cn(
                      "font-data text-lg leading-6 font-medium",
                      isStale ? "text-caution" : "text-foreground",
                    )}
                  >
                    {n}
                  </dd>
                </div>
              );
            })}
          </dl>

          {hasStale && (
            <Notice tone="caution">
              <span className="font-data text-foreground">{buckets.gt7d}</span> lead{plural} interessante
              {plural} parado{plural} há mais de 7 dias. Revise os critérios ou tome uma decisão.
            </Notice>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
