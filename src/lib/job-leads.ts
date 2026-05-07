export const jobLeadStatusOptions = [
  { value: "interesting", label: "Interessante" },
  { value: "review", label: "Revisar" },
  { value: "discarded", label: "Descartada" },
] as const;

export type JobLeadStatus = (typeof jobLeadStatusOptions)[number]["value"];

export const jobLeadUserDecisionOptions = [
  { value: "none", label: "Sem decisão" },
  { value: "approved", label: "Aprovada manualmente" },
  { value: "promoted", label: "Promovida" },
  { value: "dismissed", label: "Descartada manualmente" },
] as const;

export type JobLeadUserDecision =
  (typeof jobLeadUserDecisionOptions)[number]["value"];

export const jobLeadStatusLabelMap = Object.fromEntries(
  jobLeadStatusOptions.map((option) => [option.value, option.label]),
) as Record<JobLeadStatus, string>;

export const jobLeadUserDecisionLabelMap = Object.fromEntries(
  jobLeadUserDecisionOptions.map((option) => [option.value, option.label]),
) as Record<JobLeadUserDecision, string>;

export function isJobLeadStatus(value: string): value is JobLeadStatus {
  return jobLeadStatusOptions.some((option) => option.value === value);
}

export function isJobLeadUserDecision(
  value: string,
): value is JobLeadUserDecision {
  return jobLeadUserDecisionOptions.some((option) => option.value === value);
}

export function getJobLeadStatusLabel(value: string | null | undefined) {
  return value && isJobLeadStatus(value) ? jobLeadStatusLabelMap[value] : null;
}

export function getJobLeadUserDecisionLabel(value: string | null | undefined) {
  return value && isJobLeadUserDecision(value)
    ? jobLeadUserDecisionLabelMap[value]
    : null;
}
