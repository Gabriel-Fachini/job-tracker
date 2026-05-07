import type { LeadListItem } from "@/components/leads/types";
import { isJobLeadStatus, isJobLeadUserDecision } from "@/lib/job-leads";

export type RawLeadRow = {
  id: number;
  title: string;
  sourceUrl: string;
  sourceName: string;
  description: string | null;
  workModel: string | null;
  seniority: string | null;
  locationText: string | null;
  salaryText: string | null;
  classificationStatus: string;
  classificationScore: number | null;
  classificationReason: string | null;
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
    classificationStatus: isJobLeadStatus(row.classificationStatus)
      ? row.classificationStatus
      : "review",
    userDecision: isJobLeadUserDecision(row.userDecision)
      ? row.userDecision
      : "none",
  };
}
