import { companies, jobLeads } from "@/lib/db/schema";

/**
 * Columns every lead list reads (radar events, `/leads` page, `getLeads`).
 * One place, so a new lead field reaches the list, the SSE snapshot and the
 * refetch together.
 */
export const leadListColumns = {
  id: jobLeads.id,
  title: jobLeads.title,
  sourceUrl: jobLeads.sourceUrl,
  sourceName: jobLeads.sourceName,
  sourceKind: jobLeads.sourceKind,
  applyUrl: jobLeads.applyUrl,
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
};
