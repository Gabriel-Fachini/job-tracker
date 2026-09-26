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
            description="Visão estratégica da busca: gaps, gargalos e prioridades."
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
                    className="flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-card/40 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RefreshCw aria-hidden className="size-3.5" />
                    Atualizar
                  </button>
                </form>
              </>
            }
          />
          <KpiStrip current={current} previous={previous} />
          <div className="h-px bg-border/40" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BacklogWidget data={backlog} />
            <ClassificationWidget dist={classDist} histogram={scoreHist} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FunnelWidget data={funnel} />
            <TopCompaniesWidget rows={topCompanies} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WorkModelWidget data={workModel} />
            <ClassifierQualityWidget data={classifierQuality} />
          </div>
          <RadarTimelineWidget data={timeline} />
        </div>
  );
}
