import type { JobLeadClassification, PersistableLead } from "../types";
import { emptyTriageFields, type TriageFields, type TriageResult } from "./types";

/** The triage columns of a lead, ready for `upsertJobLead`. */
export function triageFieldsToLead(
  fields: TriageFields,
): Pick<
  PersistableLead,
  | "eligibility"
  | "contractTypes"
  | "salaryMinUsdAnnual"
  | "salaryMaxUsdAnnual"
  | "discardReason"
  | "triageEngine"
  | "triageModel"
  | "triageConfidence"
  | "triageDetails"
> {
  return {
    eligibility: fields.eligibility,
    contractTypes: fields.contractTypes,
    salaryMinUsdAnnual: fields.salaryMinUsdAnnual,
    salaryMaxUsdAnnual: fields.salaryMaxUsdAnnual,
    discardReason: fields.discardReason,
    triageEngine: fields.triageEngine,
    triageModel: fields.triageModel,
    triageConfidence: fields.triageConfidence,
    triageDetails: fields.triageDetails,
  };
}

/** Wraps a plain classifier (tests, the legacy `classifyJobLead`) in the triage result shape. */
export function classificationToTriageResult(classification: JobLeadClassification): TriageResult {
  return { classification, fields: emptyTriageFields("legacy") };
}
