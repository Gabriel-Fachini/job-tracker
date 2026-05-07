import { and, eq } from "drizzle-orm";

import type { LeadListItem } from "@/components/leads/types";
import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { mapRawLeadToListItem } from "@/lib/job-leads/mapper";

import type { PersistableLead } from "./types";

export function upsertJobLead(
  lead: PersistableLead,
): {
  id: number;
  created: boolean;
  promotedToApplicationId: number | null;
  leadSnapshot: LeadListItem;
} {
  const now = new Date();
  const existing = db
    .select({
      id: jobLeads.id,
      promotedToApplicationId: jobLeads.promotedToApplicationId,
      discoveredAt: jobLeads.discoveredAt,
    })
    .from(jobLeads)
    .where(
      and(
        eq(jobLeads.companyId, lead.companyId),
        eq(jobLeads.sourceUrl, lead.sourceUrl),
      ),
    )
    .get();

  if (existing) {
    db.update(jobLeads)
      .set({
        title: lead.title,
        sourceName: lead.sourceName,
        description: lead.description,
        workModel: lead.workModel,
        seniority: lead.seniority,
        locationText: lead.locationText,
        salaryText: lead.salaryText,
        classificationStatus: lead.classificationStatus,
        classificationScore: lead.classificationScore,
        classificationReason: lead.classificationReason,
        updatedAt: now,
      })
      .where(eq(jobLeads.id, existing.id))
      .run();

    // Query the updated lead with company info
    const leadRow = db
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
      .where(eq(jobLeads.id, existing.id))
      .get();

    const leadSnapshot = mapRawLeadToListItem(leadRow!);

    return {
      id: existing.id,
      created: false,
      promotedToApplicationId: existing.promotedToApplicationId,
      leadSnapshot,
    };
  }

  const inserted = db
    .insert(jobLeads)
    .values({
      companyId: lead.companyId,
      title: lead.title,
      sourceUrl: lead.sourceUrl,
      sourceName: lead.sourceName,
      description: lead.description,
      workModel: lead.workModel,
      seniority: lead.seniority,
      locationText: lead.locationText,
      salaryText: lead.salaryText,
      classificationStatus: lead.classificationStatus,
      classificationScore: lead.classificationScore,
      classificationReason: lead.classificationReason,
      userDecision: "none",
      userDecisionAt: null,
      promotedToApplicationId: null,
      discoveredAt: now,
      updatedAt: now,
    })
    .returning({ id: jobLeads.id })
    .get();

  // Query the inserted lead with company info
  const leadRow = db
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
    .where(eq(jobLeads.id, inserted.id))
    .get();

  const leadSnapshot = mapRawLeadToListItem(leadRow!);

  return {
    id: inserted.id,
    created: true,
    promotedToApplicationId: null,
    leadSnapshot,
  };
}
