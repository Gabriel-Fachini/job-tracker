import { Suspense } from "react";
import { asc, desc, eq } from "drizzle-orm";

import { ApplicationsClient } from "@/components/applications/applications-client";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <Suspense fallback={<ApplicationsSkeleton />}>
        <ApplicationsClient items={items} companies={companyOptions} />
      </Suspense>
    </div>
  );
}

function ApplicationsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-2 border-b border-border pb-4 sm:pb-5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="-mx-4 border-y border-border sm:mx-0 sm:rounded-xl sm:border-x">
        <div className="flex h-11 items-center gap-6 border-b border-border px-4 sm:px-5">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-3.5 w-16" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-7 w-24 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
