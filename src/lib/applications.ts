export const applicationStatusOptions = [
  { value: "interesting", label: "Interessante" },
  { value: "applied", label: "Aplicada" },
  { value: "in_process", label: "Em processo" },
  { value: "offer", label: "Oferta" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "withdrawn", label: "Desistiu" },
] as const;

export type ApplicationStatus =
  (typeof applicationStatusOptions)[number]["value"];

export const applicationStatusLabelMap = Object.fromEntries(
  applicationStatusOptions.map((o) => [o.value, o.label]),
) as Record<ApplicationStatus, string>;

export function isApplicationStatus(
  value: string,
): value is ApplicationStatus {
  return applicationStatusOptions.some((o) => o.value === value);
}

export function getApplicationStatusLabel(value: string | null | undefined) {
  return value && isApplicationStatus(value)
    ? applicationStatusLabelMap[value]
    : null;
}
