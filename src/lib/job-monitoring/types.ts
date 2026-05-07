import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { JobLeadStatus } from "@/lib/job-leads";
import type { LeadListItem } from "@/components/leads/types";

export type MonitoringCompany = {
  id: number;
  name: string;
  jobsBoardUrl: string;
  jobBoardNavigationMode: "fetch" | "browser";
};

export type FetchLike = typeof fetch;

export type DiscoveredLink = {
  url: string;
  text: string | null;
};

export type ExtractedJobDetail = {
  title: string | null;
  description: string | null;
  sourceUrl: string;
  sourceName: string;
  workModel: string | null;
  seniority: string | null;
  locationText: string | null;
  salaryText: string | null;
};

export type JobLeadSignals = {
  normalizedTitle: string;
  normalizedDescription: string;
  detectedSeniority: string | null;
  detectedWorkModels: string[];
  employmentTypes: string[];
  locationSignals: string[];
  jobFamily: string | null;
  stackSignals: string[];
  positiveSignals: string[];
  blockedSignals: string[];
};

export type ClassificationFeedbackSummary = {
  promotedExamples: string[];
  dismissedExamples: string[];
};

export type JobLeadClassification = {
  decision: JobLeadStatus;
  score: number;
  reason: string;
  matchedSignals: string[];
  riskSignals: string[];
  missingSignals: string[];
};

export type PersistableLead = ExtractedJobDetail & {
  companyId: number;
  title: string;
  classificationStatus: JobLeadStatus;
  classificationScore: number;
  classificationReason: string;
};

export type MonitoringSummary = {
  linksFound: number;
  skippedLinks: number;
  jobsParsed: number;
  leadsSaved: number;
  reviewsSaved: number;
  discarded: number;
  failed: number;
};

export type ClassificationContext = {
  companyName: string;
  profile: ProfileSnapshot | null;
  feedbackSummary: ClassificationFeedbackSummary;
};

export type MonitoringStreamEvent =
  | { type: "start"; total: number }
  | { type: "company-start"; company: string; index: number; total: number }
  | { type: "link-processing"; company: string; title: string | null; processed: number; total: number }
  | { type: "link-skipped"; url: string; companyId: number }
  | { type: "link-done"; company: string; title: string; decision: JobLeadStatus; processed: number; total: number; lead?: LeadListItem }
  | { type: "company-done"; company: string; summary: MonitoringSummary }
  | { type: "all-done"; summary: MonitoringSummary }
  | { type: "error"; message: string };
