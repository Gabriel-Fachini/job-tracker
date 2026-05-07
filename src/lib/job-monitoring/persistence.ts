import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { jobLeads } from "@/lib/db/schema";

import type { PersistableLead } from "./types";

export function upsertJobLead(lead: PersistableLead) {
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

    return {
      id: existing.id,
      created: false,
      promotedToApplicationId: existing.promotedToApplicationId,
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

  return {
    id: inserted.id,
    created: true,
    promotedToApplicationId: null,
  };
}
