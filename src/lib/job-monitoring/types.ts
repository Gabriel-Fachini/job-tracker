import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { JobLeadStatus } from "@/lib/job-leads";
import type { LeadListItem } from "@/components/leads/types";
import type { SearchPreferences } from "@/lib/search-preferences";

export type MonitoringCompany = {
  id: number;
  name: string;
  jobsBoardUrl: string;
  jobBoardNavigationMode: "fetch" | "browser";
  atsProvider?: string | null;
  atsBoardToken?: string | null;
};

export type FetchLike = typeof fetch;

export type DiscoveredLink = {
  url: string;
  text: string | null;
  prefetched?: {
    title: string;
    descriptionHtml: string;
    descriptionMarkdown?: string;
    locationText?: string;
    departments?: string[];
    offices?: string[];
    updatedAt?: string;
    externalId: string;
    /** Compensation as shown by the ATS (e.g. "$120K - $150K", "USD 8,000-10,000 / month"). */
    salaryText?: string;
    /** `remote`, `hybrid` or `onsite` when the ATS says so explicitly. */
    workModel?: "remote" | "hybrid" | "onsite";
    /** Direct application URL when it differs from the posting URL. */
    applyUrl?: string;
    /** Structured geo restrictions when the source provides them (countries or regions). */
    locationRestrictions?: string[];
  };
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
  /** Aggregator kind, or `company` for a vacancy found on the company's own board. */
  sourceKind?: string | null;
  externalId?: string | null;
  applyUrl?: string | null;
  dedupKey?: string | null;
  /** Triage fields (see `triage/types.ts`); absent for callers that only classify. */
  eligibility?: string | null;
  contractTypes?: string[] | null;
  salaryMinUsdAnnual?: number | null;
  salaryMaxUsdAnnual?: number | null;
  discardReason?: string | null;
  triageEngine?: string | null;
  triageModel?: string | null;
  triageConfidence?: number | null;
  triageDetails?: Record<string, unknown> | null;
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
  /** International search preferences (stage 0 filters); null/absent = filters off. */
  preferences?: SearchPreferences | null;
};

export type MonitoringStreamEvent =
  | { type: "start"; total: number }
  | { type: "company-start"; company: string; index: number; total: number }
  | { type: "link-processing"; company: string; title: string | null; processed: number; total: number }
  | { type: "link-skipped"; url: string; companyId: number }
  | { type: "link-done"; company: string; title: string; decision: JobLeadStatus; processed: number; total: number; lead?: LeadListItem }
  | { type: "company-done"; company: string; summary: MonitoringSummary }
  | { type: "all-done"; summary: MonitoringSummary }
  | {
      type: "error";
      message: string;
      /** Set when one company failed; the run goes on with the next one. */
      company?: string;
      /** true: the run is over (failed or refused). Company errors send false. */
      fatal?: boolean;
      /** Why a new run was refused. */
      reason?: "already-running";
    };

/** Body of `GET /api/monitoring/current`. */
export type MonitoringRunSnapshot =
  | { status: "idle"; run: null }
  | {
      /** "stale": no event for RUN_STALE_AFTER_MS; it no longer blocks runs or deploys. */
      status: "running" | "stale";
      run: {
        id: string;
        startedAt: string;
        endedAt: string | null;
        currentCompany: string | null;
        companyIndex: number;
        totalCompanies: number;
        /** Progress inside the current company. */
        linksProcessed: number;
        linksTotal: number;
        stats: { saved: number; review: number; discarded: number; failed: number };
        companyErrors: Array<{ company: string; message: string; at: string }>;
        eventCount: number;
        lastUpdatedAt: string;
      };
    };
