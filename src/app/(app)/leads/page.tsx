import { Suspense } from "react";
import { desc, eq, ne } from "drizzle-orm";

import { LeadsClient } from "@/components/leads/leads-client";
import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { mapRawLeadToListItem } from "@/lib/job-leads/mapper";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const items = db
    .select({
      id: jobLeads.id,
      title: jobLeads.title,
      sourceUrl: jobLeads.sourceUrl,
      sourceName: jobLeads.sourceName,
      description: jobLeads.description,
      workModel: jobLeads.workModel,
      seniority: jobLeads.seniority,
      locationText: jobLeads.locationText,
      salaryText: jobLeads.salaryText,
      classificationStatus: jobLeads.classificationStatus,
      classificationScore: jobLeads.classificationScore,
      classificationReason: jobLeads.classificationReason,
      userDecision: jobLeads.userDecision,
      promotedToApplicationId: jobLeads.promotedToApplicationId,
      discoveredAt: jobLeads.discoveredAt,
      updatedAt: jobLeads.updatedAt,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(jobLeads)
    .innerJoin(companies, eq(jobLeads.companyId, companies.id))
    .where(ne(jobLeads.classificationStatus, "discarded"))
    .orderBy(desc(jobLeads.updatedAt))
    .all()
    .map(mapRawLeadToListItem);

  const companyOptions = db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .orderBy(companies.name)
    .all();

  return (
    <Suspense
      fallback={
        <div aria-hidden className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 border-b border-border pb-5">
            <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-44 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="h-11 border-b border-border" />
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex gap-4 border-b border-border px-5 py-4 last:border-b-0">
                <div className="h-4 w-7 animate-pulse rounded bg-muted" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <LeadsClient companies={companyOptions} items={items} />
    </Suspense>
  );
}
