import type { JobLeadStatus, JobLeadUserDecision } from "@/lib/job-leads";

export type LeadTab = "triage" | "approved";

export type LeadListItem = {
  id: number;
  title: string;
  sourceUrl: string;
  sourceName: string;
  /** Aggregator kind (himalayas, remoteok...) or `company`; null on older leads. */
  sourceKind: string | null;
  applyUrl: string | null;
  description: string | null;
  workModel: string | null;
  seniority: string | null;
  locationText: string | null;
  salaryText: string | null;
  classificationStatus: JobLeadStatus;
  classificationScore: number | null;
  classificationReason: string | null;
  /** Triage stage 1 (international radar); null on leads triaged before it existed. */
  eligibility: string | null;
  contractTypes: string[];
  salaryMinUsdAnnual: number | null;
  salaryMaxUsdAnnual: number | null;
  discardReason: string | null;
  triageEngine: string | null;
  userDecision: JobLeadUserDecision;
  promotedToApplicationId: number | null;
  discoveredAt: Date;
  updatedAt: Date;
  companyId: number;
  companyName: string;
};
