export const companyOriginOptions = [
  { value: "manual", label: "Manual" },
  { value: "aggregator", label: "Via agregador" },
  { value: "yc_import", label: "YC" },
] as const;

export type CompanyOrigin = (typeof companyOriginOptions)[number]["value"];

export function isCompanyOrigin(value: string | null | undefined): value is CompanyOrigin {
  return companyOriginOptions.some((option) => option.value === value);
}

export function getCompanyOriginLabel(value: string | null | undefined): string | null {
  return companyOriginOptions.find((option) => option.value === value)?.label ?? null;
}

/**
 * Holds the leads that the hard filters discard before a real company would
 * be created for them (one company per junk vacancy would flood the list).
 * Status `discarded` keeps it out of the bulk radar; the list hides it.
 */
export const DISCARDED_SINK_COMPANY_NAME = "Vagas descartadas (agregadores)";
