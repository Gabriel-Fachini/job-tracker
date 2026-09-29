import type { JobLeadStatus } from "@/lib/job-leads";

import type { DiscardReason } from "./discard-reasons";
import type {
  ClassificationContext,
  ExtractedJobDetail,
  JobLeadClassification,
} from "../types";

export * from "./discard-reasons";

// ---- Stage 1 vocabulary -------------------------------------------------

export const eligibilityValues = [
  "worldwide",
  "americas_or_latam_incl_brazil",
  "brazil_explicit",
  "us_only",
  "us_canada_only",
  "europe_uk_only",
  "other_country_restricted",
  "not_stated",
] as const;
export type EligibilityValue = (typeof eligibilityValues)[number];

/** Classes that leave the door open for a candidate living in Brazil. */
export const openEligibilityValues: ReadonlySet<EligibilityValue> = new Set([
  "worldwide",
  "americas_or_latam_incl_brazil",
  "brazil_explicit",
]);

export const restrictedEligibilityValues: ReadonlySet<EligibilityValue> = new Set([
  "us_only",
  "us_canada_only",
  "europe_uk_only",
  "other_country_restricted",
]);

export const contractValues = ["employee_only", "contractor_or_eor_ok", "not_stated"] as const;
export type ContractValue = (typeof contractValues)[number];

export const timezoneValues = [
  "no_requirement",
  "americas_overlap",
  "us_pacific_hours",
  "europe_hours",
  "apac_hours",
  "not_stated",
] as const;
export type TimezoneValue = (typeof timezoneValues)[number];

export const seniorityValues = [
  "intern",
  "junior",
  "mid",
  "senior",
  "staff_plus",
  "manager",
  "not_stated",
] as const;
export type SeniorityValue = (typeof seniorityValues)[number];

/** A choice answer with the model's calibrated (Jev) or self-reported (Ollama) confidence. */
export type ChoiceResult<T extends string = string> = {
  value: T;
  confidence: number;
  probabilities?: Record<string, number>;
};

export type EligibilityAnswers = {
  eligibility: ChoiceResult<EligibilityValue>;
  /** Probability (0-1) that US work authorization is required. */
  usWorkAuthorizationRequired: number;
  contract: ChoiceResult<ContractValue>;
  timezone: ChoiceResult<TimezoneValue>;
  seniority: ChoiceResult<SeniorityValue>;
  jobFamily: ChoiceResult<string>;
  /** Id of the salary candidate chosen as the base range, or null (`none` / no candidates). */
  salarySpan: ChoiceResult<string> | null;
};

/** A fit rating on 5 levels (1 = worst, 5 = best), possibly fractional (Jev). */
export type LevelResult = { value: number; confidence: number };

export type FitAnswers = {
  stackMatch: LevelResult;
  seniorityMatch: LevelResult;
  /** Null when the profile has no company-type/values preference to compare against. */
  domainInterest: LevelResult | null;
  /** Probability (0-1) of red flags (commission-only, unpaid, dubious crypto...). */
  redFlags: number;
};

export type TriageEngineName = "openai" | "jev" | "ollama";

/** Both engines (Jev, Ollama) implement this contract; everything downstream is identical. */
export interface TriageEngine {
  readonly name: TriageEngineName;
  readonly model: string;
  answerEligibility(input: EligibilityInput): Promise<EligibilityAnswers>;
  answerFit(input: FitInput): Promise<FitAnswers>;
}

export type SalaryCandidate = {
  id: string;
  /** The matched text, e.g. `$120k-$150k`. */
  text: string;
  /** A short window of surrounding text, so the model can tell a base range from a bonus. */
  context: string;
};

export type EligibilityInput = {
  /** Lean state (title, location, work model, relevant sentences), already size-capped. */
  state: Record<string, unknown>;
  families: string[];
  salaryCandidates: SalaryCandidate[];
};

export type FitInput = {
  state: Record<string, unknown>;
  /** Structured candidate profile (skills, years, seniority, families); no personal data. */
  candidate: Record<string, unknown>;
  hasDomainPreference: boolean;
};

// ---- Job / result ------------------------------------------------------

/** A vacancy as the pipeline hands it to the triage. */
export type TriageJob = ExtractedJobDetail & {
  companyName?: string;
  /** Countries/regions the employer restricts hiring to (structured feeds). */
  locationRestrictions?: string[];
  /** UTC offsets (hours) the employer accepts. */
  timezoneRestrictions?: number[];
  /** Structured compensation when the source provides it. */
  salary?: { min?: number; max?: number; currency?: string; period?: "year" | "month" | "hour" };
  /** Aggregator kind; null/absent for the company's own board. */
  sourceKind?: string | null;
};

export type TriageContext = ClassificationContext;

/** Everything the persistence layer stores besides the classification itself. */
export type TriageFields = {
  eligibility: string | null;
  contractTypes: string[] | null;
  salaryMinUsdAnnual: number | null;
  salaryMaxUsdAnnual: number | null;
  discardReason: DiscardReason | null;
  triageEngine: "rules" | "legacy" | TriageEngineName;
  triageModel: string | null;
  triageConfidence: number | null;
  triageDetails: Record<string, unknown> | null;
};

export type TriageResult = {
  classification: JobLeadClassification;
  fields: TriageFields;
};

export function emptyTriageFields(engine: TriageFields["triageEngine"] = "legacy"): TriageFields {
  return {
    eligibility: null,
    contractTypes: null,
    salaryMinUsdAnnual: null,
    salaryMaxUsdAnnual: null,
    discardReason: null,
    triageEngine: engine,
    triageModel: null,
    triageConfidence: null,
    triageDetails: null,
  };
}

export type { JobLeadStatus };
