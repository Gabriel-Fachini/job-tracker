import { Suspense } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { Activity, GitMerge, Sparkles, Telescope } from "lucide-react";

import { ApplicationsClient } from "@/components/applications/applications-client";
import { normalizeApplicationStatus } from "@/lib/applications";
import { db } from "@/lib/db";
import { applications, applicationStages, companies, jobs } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const rows = db
    .select({
      id: applications.id,
      status: applications.status,
      notes: applications.notes,
      usedResumeStatus: applications.usedResumeStatus,
      usedResumePath: applications.usedResumePath,
      usedResumeOriginalFilename: applications.usedResumeOriginalFilename,
      generatedResumePath: applications.generatedResumePath,
      appliedAt: applications.appliedAt,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      isReferral: applications.isReferral,
      // job fields
      jobTitle: jobs.title,
      company: companies.name,
      description: jobs.description,
      sourceUrl: jobs.sourceUrl,
      sourceName: jobs.sourceName,
      workModel: jobs.workModel,
      seniority: jobs.seniority,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .orderBy(desc(applications.createdAt))
    .all();

  const stageRows = db
    .select({
      id: applicationStages.id,
      applicationId: applicationStages.applicationId,
      label: applicationStages.label,
      date: applicationStages.date,
      notes: applicationStages.notes,
      createdAt: applicationStages.createdAt,
    })
    .from(applicationStages)
    .orderBy(asc(applicationStages.date), asc(applicationStages.createdAt))
    .all();

  const stagesByApplication = new Map<number, typeof stageRows>();
  for (const stage of stageRows) {
    const current = stagesByApplication.get(stage.applicationId) ?? [];
    current.push(stage);
    stagesByApplication.set(stage.applicationId, current);
  }

  const items = rows.map((row) => ({
    ...row,
    status: normalizeApplicationStatus(row.status),
    stages: stagesByApplication.get(row.id) ?? [],
  }));
  const companyOptions = db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .orderBy(companies.name)
    .all();

  const appliedCount = items.filter((r) => r.status === "applied").length;
  const inProcessCount = items.filter((r) => r.status === "in_process").length;
  const offerCount = items.filter((r) => r.status === "offer").length;
  const closedCount = items.filter((r) =>
    ["approved", "rejected", "withdrawn"].includes(r.status),
  ).length;

  const statCards = [
    {
      label: "Aplicadas",
      count: appliedCount,
      icon: Telescope,
      colorClass: "border-sky-400/20 bg-sky-400/8",
      iconClass: "text-sky-300/80",
      textClass: "text-sky-100",
    },
    {
      label: "Em processo",
      count: inProcessCount,
      icon: GitMerge,
      colorClass: "border-violet-400/20 bg-violet-400/8",
      iconClass: "text-violet-300/80",
      textClass: "text-violet-100",
    },
    {
      label: "Ofertas",
      count: offerCount,
      icon: Sparkles,
      colorClass: "border-amber-300/20 bg-amber-300/8",
      iconClass: "text-amber-200/80",
      textClass: "text-amber-100",
    },
    {
      label: "Finalizadas",
      count: closedCount,
      icon: Activity,
      colorClass: "border-zinc-400/20 bg-zinc-400/8",
      iconClass: "text-zinc-400/80",
      textClass: "text-zinc-300",
    },
  ];

  // Phones read these counts from the status tabs; the grid is desktop overview.
  // Keyed: it arrives in the client list as a prop from the server.
  const summary = (
    <div key="summary" className="hidden gap-3 md:grid md:grid-cols-4">
      {statCards.map(({ label, count, icon: Icon, colorClass, iconClass, textClass }) => (
        <div
          key={label}
          className={`relative overflow-hidden rounded-2xl border p-4 ${colorClass}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <Icon className={`size-4 shrink-0 ${iconClass}`} />
          </div>
          <p className={`mt-3 text-3xl font-semibold tabular-nums ${textClass}`}>
            {count}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-8">
      <Suspense fallback={<ApplicationsSkeleton />}>
        <ApplicationsClient items={items} companies={companyOptions} summary={summary} />
      </Suspense>
    </div>
  );
}

function ApplicationsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5 sm:gap-8">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-foreground/8" />
      <div className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2 px-4 py-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-foreground/8" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-foreground/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
