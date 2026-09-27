import { Suspense } from "react";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { BacklogWidget } from "@/components/dashboard/backlog-widget";
import { ClassifierQualityWidget } from "@/components/dashboard/classifier-quality-widget";
import { FunnelWidget } from "@/components/dashboard/funnel-widget";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { ClassificationWidget } from "@/components/dashboard/classification-widget";
import { RadarTimelineWidget } from "@/components/dashboard/radar-timeline-widget";
import { TopCompaniesWidget } from "@/components/dashboard/top-companies-widget";
import { WorkModelWidget } from "@/components/dashboard/work-model-widget";
import { buttonVariants } from "@/components/ui/button";
import {
  getBacklogData,
  getClassificationDist,
  getClassifierQuality,
  getFunnelData,
  getKpiData,
  getRadarTimeline,
  getScoreHistogram,
  getTopCompanies,
  getWorkModelMatch,
  resolvePeriod,
  type DashboardRange,
} from "@/server/queries/dashboard";

function isValidRange(v: unknown): v is DashboardRange {
  return v === "30d" || v === "90d" || v === "all";
}

const PERIOD_LABELS: Record<DashboardRange, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  all: "Todo o período",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range: DashboardRange = isValidRange(rawRange) ? rawRange : "30d";

  const { from, to, prevFrom, prevTo } = resolvePeriod(range);
  const [current, previous, backlog, timeline, classDist, scoreHist, funnel, topCompanies, workModel, classifierQuality] =
    await Promise.all([
      Promise.resolve(getKpiData(from, to)),
      Promise.resolve(prevFrom && prevTo ? getKpiData(prevFrom, prevTo) : null),
      Promise.resolve(getBacklogData()),
      Promise.resolve(getRadarTimeline(from, to)),
      Promise.resolve(getClassificationDist(from, to)),
      Promise.resolve(getScoreHistogram(from, to)),
      Promise.resolve(getFunnelData(from, to)),
      Promise.resolve(getTopCompanies(from, to)),
      Promise.resolve(getWorkModelMatch(from, to)),
      Promise.resolve(getClassifierQuality()),
    ]);

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Dashboard"
        description={PERIOD_LABELS[range]}
        actionsPlacement="stacked"
        actions={
          <>
            <Suspense>
              <PeriodFilter current={range} />
            </Suspense>
            {/* Phones refresh with pull-to-refresh. */}
            <form action="/dashboard" method="get" className="hidden sm:block">
              <input type="hidden" name="range" value={range} />
              <button
                type="submit"
                aria-label="Atualizar"
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <RefreshCw aria-hidden />
              </button>
            </form>
          </>
        }
      />

      <KpiStrip current={current} previous={previous} />

      {/* One panel grid: the 1px gap over bg-border draws the shared hairlines. */}
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-2">
        <BacklogWidget data={backlog} />
        <ClassificationWidget dist={classDist} histogram={scoreHist} />
        {/* The compact widgets stack beside the taller company table. */}
        <div className="grid min-w-0 gap-px">
          <FunnelWidget data={funnel} />
          <WorkModelWidget data={workModel} />
          <ClassifierQualityWidget data={classifierQuality} />
        </div>
        <TopCompaniesWidget rows={topCompanies} />
        <RadarTimelineWidget data={timeline} className="lg:col-span-2" />
      </div>
    </div>
  );
}
