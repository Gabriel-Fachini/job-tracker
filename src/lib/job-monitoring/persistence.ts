import { and, desc, eq, gte, inArray } from "drizzle-orm";

import type { LeadListItem } from "@/components/leads/types";
import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { mapRawLeadToListItem } from "@/lib/job-leads/mapper";
import { leadListColumns } from "@/lib/job-leads/select";

import type { PersistableLead } from "./types";

/** A vacancy seen in the last DEDUP_WINDOW_DAYS with the same dedup key is the same vacancy. */
export const DEDUP_WINDOW_DAYS = 60;

export function touchLastViewed(companyId: number, sourceUrls: string[]): void {
  if (sourceUrls.length === 0) return;

  const now = new Date();
  db.update(jobLeads)
    .set({ lastViewed: now })
    .where(
      and(
        eq(jobLeads.companyId, companyId),
        inArray(jobLeads.sourceUrl, sourceUrls),
      ),
    )
    .run();
}

export function getExistingJobLeadUrls(
  companyId: number,
  sourceUrls: string[],
): Set<string> {
  if (sourceUrls.length === 0) return new Set();

  const rows = db
    .select({ sourceUrl: jobLeads.sourceUrl })
    .from(jobLeads)
    .where(
      and(
        eq(jobLeads.companyId, companyId),
        inArray(jobLeads.sourceUrl, sourceUrls),
      ),
    )
    .all();

  return new Set(rows.map((r) => r.sourceUrl));
}

/** Same as above without a company: aggregated jobs are matched before their company is resolved. */
export function getExistingLeadUrlsAnyCompany(sourceUrls: string[]): Set<string> {
  const found = new Set<string>();

  // SQLite caps bound parameters; feeds can bring a few hundred URLs.
  for (let start = 0; start < sourceUrls.length; start += 200) {
    const chunk = sourceUrls.slice(start, start + 200);
    const rows = db
      .select({ sourceUrl: jobLeads.sourceUrl })
      .from(jobLeads)
      .where(inArray(jobLeads.sourceUrl, chunk))
      .all();

    for (const row of rows) {
      found.add(row.sourceUrl);
    }
  }

  return found;
}

export function touchLastViewedByUrls(sourceUrls: string[]): void {
  for (let start = 0; start < sourceUrls.length; start += 200) {
    db.update(jobLeads)
      .set({ lastViewed: new Date() })
      .where(inArray(jobLeads.sourceUrl, sourceUrls.slice(start, start + 200)))
      .run();
  }
}

export type DedupMatch = {
  id: number;
  companyId: number;
  sourceKind: string | null;
  sourceUrl: string;
};

/** Lead with the same dedup key discovered in the last `DEDUP_WINDOW_DAYS`, newest first. */
export function findLeadByDedupKey(
  dedupKey: string,
  now: Date = new Date(),
): DedupMatch | null {
  const since = new Date(now.getTime() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return (
    db
      .select({
        id: jobLeads.id,
        companyId: jobLeads.companyId,
        sourceKind: jobLeads.sourceKind,
        sourceUrl: jobLeads.sourceUrl,
      })
      .from(jobLeads)
      .where(and(eq(jobLeads.dedupKey, dedupKey), gte(jobLeads.discoveredAt, since)))
      .orderBy(desc(jobLeads.discoveredAt))
      .get() ?? null
  );
}

/**
 * The company's own board found a vacancy an aggregator had already reported:
 * the lead now points at the ATS page (better source and apply link).
 */
export function adoptAtsLink(
  leadId: number,
  ats: { sourceUrl: string; sourceName: string; applyUrl: string | null; externalId: string | null },
): boolean {
  try {
    db.update(jobLeads)
      .set({
        sourceUrl: ats.sourceUrl,
        sourceName: ats.sourceName,
        sourceKind: "company",
        applyUrl: ats.applyUrl,
        externalId: ats.externalId,
        lastViewed: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobLeads.id, leadId))
      .run();

    return true;
  } catch {
    // The ATS URL already exists for that company (unique index): nothing to adopt.
    return false;
  }
}

function readLeadSnapshot(leadId: number): LeadListItem {
  const leadRow = db
    .select(leadListColumns)
    .from(jobLeads)
    .innerJoin(companies, eq(jobLeads.companyId, companies.id))
    .where(eq(jobLeads.id, leadId))
    .get();

  return mapRawLeadToListItem(leadRow!);
}

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

  const sourceFields = {
    sourceKind: lead.sourceKind ?? null,
    externalId: lead.externalId ?? null,
    applyUrl: lead.applyUrl ?? null,
    dedupKey: lead.dedupKey ?? null,
  };

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
        ...sourceFields,
        classificationStatus: lead.classificationStatus,
        classificationScore: lead.classificationScore,
        classificationReason: lead.classificationReason,
        lastViewed: now,
        updatedAt: now,
      })
      .where(eq(jobLeads.id, existing.id))
      .run();

    return {
      id: existing.id,
      created: false,
      promotedToApplicationId: existing.promotedToApplicationId,
      leadSnapshot: readLeadSnapshot(existing.id),
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
      ...sourceFields,
      classificationStatus: lead.classificationStatus,
      classificationScore: lead.classificationScore,
      classificationReason: lead.classificationReason,
      userDecision: "none",
      userDecisionAt: null,
      promotedToApplicationId: null,
      discoveredAt: now,
      lastViewed: now,
      updatedAt: now,
    })
    .returning({ id: jobLeads.id })
    .get();

  return {
    id: inserted.id,
    created: true,
    promotedToApplicationId: null,
    leadSnapshot: readLeadSnapshot(inserted.id),
  };
}
