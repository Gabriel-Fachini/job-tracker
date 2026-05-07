import { Suspense } from "react";
import { desc, eq, ne } from "drizzle-orm";

import { LeadsClient } from "@/components/leads/leads-client";
import type { LeadListItem } from "@/components/leads/types";
import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { mapRawLeadToListItem } from "@/lib/job-leads/mapper";

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
        <div className="rounded-3xl border border-border/50 bg-card/40 px-5 py-10 text-sm text-muted-foreground">
          Carregando fila de leads...
        </div>
      }
    >
      <LeadsClient companies={companyOptions} items={items} />
    </Suspense>
  );
}
