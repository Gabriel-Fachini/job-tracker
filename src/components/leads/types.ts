import type { JobLeadStatus, JobLeadUserDecision } from "@/lib/job-leads";

export type LeadTab = "triage" | "approved";

export type LeadListItem = {
  id: number;
  title: string;
  sourceUrl: string;
  sourceName: string;
  description: string | null;
  workModel: string | null;
  seniority: string | null;
  locationText: string | null;
  salaryText: string | null;
  classificationStatus: JobLeadStatus;
  classificationScore: number | null;
  classificationReason: string | null;
  userDecision: JobLeadUserDecision;
  promotedToApplicationId: number | null;
  discoveredAt: Date;
  updatedAt: Date;
  companyId: number;
  companyName: string;
};
