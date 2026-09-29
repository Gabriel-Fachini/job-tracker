import type { SalaryCandidate } from "./types";

/**
 * Salary handling for the triage. All arithmetic lives here, in code: the model
 * only ever picks which extracted candidate is the job's base range.
 */

export type SalaryPeriod = "year" | "month" | "week" | "hour";

export type ParsedSalary = {
  min: number | null;
  max: number | null;
  /** ISO-ish code (`USD`, `EUR`, `BRL`...) or null when the text names no currency. */
  currency: string | null;
  /** Null when the text does not say (and it could not be inferred safely). */
  period: SalaryPeriod | null;
};

export type AnnualUsdRange = { min: number; max: number };

export type ExtractedSalaryCandidate = SalaryCandidate & { parsed: ParsedSalary };

const HOURS_PER_YEAR = 2080;
const PERIOD_MULTIPLIER: Record<SalaryPeriod, number> = {
  year: 1,
  month: 12,
  week: 52,
  hour: HOURS_PER_YEAR,
};

const CURRENCY_MARKER =
  "(?:US\\$|USD|CA\\$|C\\$|CAD|AU\\$|A\\$|AUD|NZ\\$|NZD|MX\\$|MXN|R\\$|BRL|EUR|GBP|CHF|€|£|\\$)";
// 120,000.50 (en) | 12.000,50 (pt-BR) | 120000 | 12.5
const AMOUNT = "\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:\\.\\d+)?";
const SUFFIX = "(?:\\s?[kK]\\b|\\s?[mM]\\b)?";
const RANGE_SEPARATOR = "\\s*(?:-|\u2013|\u2014|to|até)\\s*";

// [currency] amount[k] [ (- | to) [currency] amount[k] ] [currency code]
const SALARY_PATTERN = new RegExp(
  `(?<![\\w$€£])(?:(${CURRENCY_MARKER})\\s?)?(${AMOUNT})${SUFFIX}` +
    `(?:${RANGE_SEPARATOR}(?:(${CURRENCY_MARKER})\\s?)?(${AMOUNT})${SUFFIX})?` +
    `(?:\\s?(USD|EUR|GBP|CAD|AUD|BRL|CHF))?`,
  "gi",
);

const CURRENCY_BY_MARKER: Record<string, string> = {
  "$": "USD",
  "us$": "USD",
  usd: "USD",
  "ca$": "CAD",
  "c$": "CAD",
  cad: "CAD",
  "au$": "AUD",
  "a$": "AUD",
  aud: "AUD",
  "nz$": "NZD",
  nzd: "NZD",
  "mx$": "MXN",
  mxn: "MXN",
  "r$": "BRL",
  brl: "BRL",
  eur: "EUR",
  "€": "EUR",
  gbp: "GBP",
  "£": "GBP",
  chf: "CHF",
};

function currencyOf(marker: string | undefined): string | null {
  return marker ? (CURRENCY_BY_MARKER[marker.toLowerCase()] ?? null) : null;
}

function detectPeriod(text: string): SalaryPeriod | null {
  if (/\/\s?(?:yr|year|annum)\b|\bper\s+(?:year|annum)\b|\bannual(?:ly)?\b|\byearly\b|\ba\s+year\b|\bp\.?a\.?\b/i.test(text)) {
    return "year";
  }

  if (/\/\s?(?:mo|month)\b|\bper\s+month\b|\bmonthly\b|\ba\s+month\b/i.test(text)) {
    return "month";
  }

  if (/\/\s?(?:hr|hour)\b|\bper\s+hour\b|\bhourly\b|\ban\s+hour\b/i.test(text)) {
    return "hour";
  }

  if (/\/\s?(?:wk|week)\b|\bper\s+week\b|\bweekly\b/i.test(text)) {
    return "week";
  }

  return null;
}

function parseAmount(raw: string): number {
  // 12.000,50 (pt-BR): dots are thousands, the comma is the decimal mark.
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) {
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }

  return Number(raw.replace(/,/g, ""));
}

function toNumber(raw: string, suffix: string | undefined): number {
  const value = parseAmount(raw);
  const unit = suffix?.trim().toLowerCase();

  if (unit === "k") return value * 1000;
  if (unit === "m") return value * 1_000_000;

  return value;
}

/** Splits `120k` into its number and unit suffix from a matched fragment. */
function splitAmount(fragment: string): { raw: string; suffix: string | undefined } {
  const match = /^(\d[\d,.]*)\s?([kKmM])?$/.exec(fragment.trim());

  return { raw: match?.[1] ?? fragment, suffix: match?.[2] };
}

type RawMatch = {
  index: number;
  text: string;
  parsed: ParsedSalary;
  /** True when the text itself states a currency, a k/m unit or a period (not a bare number). */
  hasMarker: boolean;
};

function scan(text: string): RawMatch[] {
  const matches: RawMatch[] = [];

  for (const match of text.matchAll(SALARY_PATTERN)) {
    const [full, marker1, amount1, marker2, amount2, codeSuffix] = match;
    const index = match.index ?? 0;
    // Recover the k/m suffix of each side from the full match.
    const sides = full.split(new RegExp(RANGE_SEPARATOR, "i"));
    const left = splitAmount(amount1 + (/\d\s?[kKmM]\b/.test(sides[0] ?? "") ? (sides[0]?.match(/[kKmM]\b/)?.[0] ?? "") : ""));
    const right = amount2
      ? splitAmount(amount2 + (/\d\s?[kKmM]\b/.test(sides[1] ?? "") ? (sides[1]?.match(/[kKmM]\b/)?.[0] ?? "") : ""))
      : null;

    // "120-150k": the unit written once applies to both sides.
    const leftSuffix = left.suffix ?? (right?.suffix && parseAmount(left.raw) < 1000 ? right.suffix : undefined);
    const min = toNumber(left.raw, leftSuffix);
    const max = right ? toNumber(right.raw, right.suffix) : null;
    const currency =
      currencyOf(marker1) ?? currencyOf(marker2) ?? currencyOf(codeSuffix) ?? null;
    const window = text.slice(index, index + full.length + 24);
    const period = detectPeriod(window);
    const hasMarker = Boolean(currency) || Boolean(leftSuffix) || Boolean(right?.suffix) || period !== null;

    matches.push({
      index,
      text: full.trim(),
      hasMarker,
      parsed: {
        min: max !== null ? Math.min(min, max) : min,
        max: max !== null ? Math.max(min, max) : min,
        currency,
        period,
      },
    });
  }

  return matches;
}

/** Parses a free-form compensation string (`$140K - $180K`, `USD 8,000 / month`). */
export function parseSalaryText(text: string | null | undefined): ParsedSalary | null {
  if (!text?.trim()) {
    return null;
  }

  const candidates = scan(text).filter((match) => match.hasMarker);

  if (candidates.length === 0) {
    return null;
  }

  // The first amount that carries a currency or unit is the headline figure.
  const best = candidates.find((match) => match.parsed.currency) ?? candidates[0];

  return {
    ...best.parsed,
    // A period written elsewhere in the string ("... per year") still applies.
    period: best.parsed.period ?? detectPeriod(text),
  };
}

/** Salary-looking figures in a description, for the model to choose the base range from. */
export function extractSalaryCandidates(
  description: string | null | undefined,
  limit = 5,
): ExtractedSalaryCandidate[] {
  if (!description) {
    return [];
  }

  const seen = new Set<string>();
  const candidates: ExtractedSalaryCandidate[] = [];

  for (const match of scan(description)) {
    // Bare numbers ("25 years") are noise; a currency, unit or period must be present.
    if (!match.hasMarker || (match.parsed.min ?? 0) < 1) {
      continue;
    }

    const key = `${match.parsed.min}-${match.parsed.max}-${match.parsed.currency}-${match.parsed.period}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const start = Math.max(0, match.index - 70);
    const end = Math.min(description.length, match.index + match.text.length + 70);

    candidates.push({
      id: `c${candidates.length + 1}`,
      text: match.text,
      context: description.slice(start, end).replace(/\s+/g, " ").trim(),
      parsed: match.parsed,
    });

    if (candidates.length >= limit) {
      break;
    }
  }

  return candidates;
}

/**
 * Annual USD range, or null when it is not USD or the period is unknown.
 * Without an explicit period a figure of 20k or more is read as yearly; smaller
 * bare figures are ambiguous (monthly? hourly?) and stay unknown.
 */
export function toAnnualUsd(salary: ParsedSalary | null | undefined): AnnualUsdRange | null {
  if (!salary || salary.currency !== "USD") {
    return null;
  }

  const min = salary.min ?? salary.max;
  const max = salary.max ?? salary.min;

  if (min === null || max === null || min <= 0) {
    return null;
  }

  let period = salary.period;

  if (!period) {
    if (min >= 20_000) {
      period = "year";
    } else {
      return null;
    }
  }

  const factor = PERIOD_MULTIPLIER[period];

  return { min: Math.round(min * factor), max: Math.round(max * factor) };
}

/** Structured compensation from a source (already numeric). */
export function toAnnualUsdFromStructured(
  salary: { min?: number; max?: number; currency?: string; period?: SalaryPeriod } | null | undefined,
): AnnualUsdRange | null {
  if (!salary) {
    return null;
  }

  return toAnnualUsd({
    min: salary.min ?? null,
    max: salary.max ?? null,
    currency: salary.currency?.toUpperCase() ?? null,
    period: salary.period ?? null,
  });
}

/** `US$ 120-150 mil/ano`, the way the lead's `reason` reads. */
export function formatAnnualUsdRange(range: AnnualUsdRange): string {
  const thousands = (value: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1000);

  if (range.min === range.max) {
    return `US$ ${thousands(range.min)} mil/ano`;
  }

  return `US$ ${thousands(range.min)}–${thousands(range.max)} mil/ano`;
}
