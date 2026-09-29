import type { LeadListItem } from "@/components/leads/types";
import { isJobLeadStatus, isJobLeadUserDecision } from "@/lib/job-leads";

export type RawLeadRow = {
  id: number;
  title: string;
  sourceUrl: string;
  sourceName: string;
  sourceKind: string | null;
  applyUrl: string | null;
  description: string | null;
  workModel: string | null;
  seniority: string | null;
  locationText: string | null;
  salaryText: string | null;
  classificationStatus: string;
  classificationScore: number | null;
  classificationReason: string | null;
  eligibility: string | null;
  /** JSON string[] as stored. */
  contractTypes: string | null;
  salaryMinUsdAnnual: number | null;
  salaryMaxUsdAnnual: number | null;
  discardReason: string | null;
  triageEngine: string | null;
  userDecision: string;
  promotedToApplicationId: number | null;
  discoveredAt: Date;
  updatedAt: Date;
  companyId: number;
  companyName: string;
};

export function mapRawLeadToListItem(row: RawLeadRow): LeadListItem {
  return {
    ...row,
    contractTypes: parseStringArray(row.contractTypes),
    classificationStatus: isJobLeadStatus(row.classificationStatus)
      ? row.classificationStatus
      : "review",
    userDecision: isJobLeadUserDecision(row.userDecision)
      ? row.userDecision
      : "none",
  };
}

function parseStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
