import { Suspense } from "react";
import { RefreshCw } from "lucide-react";

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
    <div className="flex flex-1 flex-col gap-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Dashboard
          </h1>
          <p className="text-base text-muted-foreground">
            Visão estratégica da busca — identifique gaps e prioridades.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Suspense>
            <PeriodFilter current={range} />
          </Suspense>
          <form action="/dashboard" method="get">
            <input type="hidden" name="range" value={range} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-3 py-2 text-xs text-muted-foreground transition-all hover:text-foreground sm:w-auto"
            >
              <RefreshCw className="size-3" />
              Refresh
            </button>
          </form>
        </div>
      </div>

      {/* KPI strip */}
      <KpiStrip current={current} previous={previous} />

      <div className="h-px bg-border/40" />

      {/* Row 1: backlog + classification */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BacklogWidget data={backlog} />
        <ClassificationWidget dist={classDist} histogram={scoreHist} />
      </div>

      {/* Row 2: funnel + top companies */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelWidget data={funnel} />
        <TopCompaniesWidget rows={topCompanies} />
      </div>

      {/* Row 3: work model + classifier quality */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WorkModelWidget data={workModel} />
        <ClassifierQualityWidget data={classifierQuality} />
      </div>

      {/* Row 4: radar timeline full-width */}
      <RadarTimelineWidget data={timeline} />
    </div>
  );
}
