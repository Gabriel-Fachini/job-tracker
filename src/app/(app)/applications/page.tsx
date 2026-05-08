import { Suspense } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { Activity, GitMerge, Sparkles, Telescope } from "lucide-react";

import { ApplicationsClient } from "@/components/applications/applications-client";
import { normalizeApplicationStatus } from "@/lib/applications";
import { db } from "@/lib/db";
import { applications, applicationStages, companies, jobs } from "@/lib/db/schema";

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
  const boardKey = items
    .map((item) => `${item.id}:${item.updatedAt.getTime()}`)
    .join("|");

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
      colorClass: "border-emerald-300/20 bg-emerald-300/8",
      iconClass: "text-emerald-200/80",
      textClass: "text-emerald-100",
    },
    {
      label: "Finalizadas",
      count: closedCount,
      icon: Activity,
      colorClass: "border-emerald-400/20 bg-emerald-400/8",
      iconClass: "text-emerald-300/80",
      textClass: "text-emerald-100",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-x-hidden">
      {/* Page header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Candidaturas
        </h1>
        <p className="text-base text-muted-foreground">
          Acompanhe o status de cada processo seletivo.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(({ label, count, icon: Icon, colorClass, iconClass, textClass }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${colorClass}`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </p>
              <Icon className={`size-3.5 shrink-0 ${iconClass}`} />
            </div>
            <p className={`mt-3 text-3xl font-semibold tabular-nums ${textClass}`}>
              {count}
            </p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Client section: toolbar + cards + modals */}
      <Suspense
        fallback={
          <div className="rounded-3xl border border-border/50 bg-card/40 px-5 py-10 text-sm text-muted-foreground">
            Carregando board de candidaturas...
          </div>
        }
      >
        <ApplicationsClient key={boardKey} items={items} companies={companyOptions} />
      </Suspense>
    </div>
  );
}
