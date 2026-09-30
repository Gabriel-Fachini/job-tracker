import type { LeadListItem } from "@/components/leads/types";

/** Triage fields of a lead that was never triaged (older leads, test fixtures). */
export const emptyLeadTriage: Pick<
  LeadListItem,
  | "eligibility"
  | "contractTypes"
  | "salaryMinUsdAnnual"
  | "salaryMaxUsdAnnual"
  | "discardReason"
  | "triageEngine"
> = {
  eligibility: null,
  contractTypes: [],
  salaryMinUsdAnnual: null,
  salaryMaxUsdAnnual: null,
  discardReason: null,
  triageEngine: null,
};
