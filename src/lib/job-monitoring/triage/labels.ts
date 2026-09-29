/** pt-BR labels for the triage vocabulary. Pure and client-safe (used by the lead detail and the dashboard). */

export const ELIGIBILITY_LABELS: Record<string, string> = {
  worldwide: "mundo todo",
  americas_or_latam_incl_brazil: "Américas/LATAM",
  brazil_explicit: "Brasil explícito",
  us_only: "só EUA",
  us_canada_only: "só EUA/Canadá",
  europe_uk_only: "só Europa/Reino Unido",
  other_country_restricted: "restrita a outro país",
  not_stated: "não informada",
};

export const CONTRACT_LABELS: Record<string, string> = {
  employee: "empregado",
  contractor: "contractor",
  eor: "EOR",
};

export function getEligibilityLabel(value: string | null | undefined): string | null {
  return value ? (ELIGIBILITY_LABELS[value] ?? value) : null;
}

export function formatContractTypes(types: string[]): string | null {
  return types.length > 0 ? types.map((type) => CONTRACT_LABELS[type] ?? type).join(", ") : null;
}

/** `US$ 120–150 mil/ano` from the stored annual USD bounds. */
export function formatUsdAnnualBounds(min: number | null, max: number | null): string | null {
  const low = min ?? max;
  const high = max ?? min;

  if (low === null || high === null) {
    return null;
  }

  const thousands = (value: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1000);

  return low === high ? `US$ ${thousands(low)} mil/ano` : `US$ ${thousands(low)}–${thousands(high)} mil/ano`;
}
