/** Pure (client-safe): why a lead was discarded, by the triage or by the user. */

export const discardReasonOptions = [
  { value: "location_ineligible", label: "Localização inelegível" },
  { value: "salary_below_min", label: "Salário abaixo do mínimo" },
  { value: "job_family_mismatch", label: "Área da vaga fora do alvo" },
  { value: "seniority_mismatch", label: "Senioridade não combina" },
  { value: "contract_mismatch", label: "Tipo de contrato não combina" },
  { value: "low_fit", label: "Pouco aderente ao perfil" },
  { value: "other", label: "Outro motivo" },
] as const;

export type DiscardReason = (typeof discardReasonOptions)[number]["value"];

/** Manual discards add "not interested" (no automatic counterpart). */
export const userDiscardReasonOptions = [
  ...discardReasonOptions,
  { value: "not_interested", label: "Não tenho interesse" },
] as const;

export type UserDiscardReason = (typeof userDiscardReasonOptions)[number]["value"];

export function isDiscardReason(value: string | null | undefined): value is DiscardReason {
  return discardReasonOptions.some((option) => option.value === value);
}

export function isUserDiscardReason(value: string | null | undefined): value is UserDiscardReason {
  return userDiscardReasonOptions.some((option) => option.value === value);
}

export function getDiscardReasonLabel(value: string | null | undefined): string | null {
  return userDiscardReasonOptions.find((option) => option.value === value)?.label ?? null;
}
