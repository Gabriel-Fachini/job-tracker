/**
 * International search preferences: pure types, options and normalization.
 * Persistence lives in `search-preferences-queries.ts`. There are no personal
 * defaults here on purpose: the user fills everything in Perfil > Busca
 * internacional, and "no preferences" means every filter is off.
 */

export const contractOptions = [
  { value: "employee", label: "Empregado direto" },
  { value: "contractor", label: "Contractor" },
  { value: "eor", label: "EOR (Deel, Remote...)" },
  { value: "pj", label: "PJ" },
] as const;

export const eligibilityOptions = [
  { value: "worldwide", label: "Mundo todo" },
  { value: "americas", label: "Américas" },
  { value: "latam", label: "América Latina" },
  { value: "brazil", label: "Brasil" },
] as const;

export const targetSeniorityOptions = [
  { value: "junior", label: "Júnior" },
  { value: "mid", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "staff_plus", label: "Staff ou acima" },
] as const;

export const jobFamilyOptions = [
  { value: "backend", label: "Backend" },
  { value: "fullstack", label: "Fullstack" },
  { value: "frontend", label: "Frontend" },
  { value: "data", label: "Dados" },
  { value: "devops", label: "DevOps / Infra" },
  { value: "mobile", label: "Mobile" },
  { value: "ai_ml", label: "IA / ML" },
] as const;

export type ContractType = (typeof contractOptions)[number]["value"];
export type EligibilityScope = (typeof eligibilityOptions)[number]["value"];
export type TargetSeniority = (typeof targetSeniorityOptions)[number]["value"];
export type JobFamily = (typeof jobFamilyOptions)[number]["value"];

export const defaultAnswerFields = [
  {
    key: "us_work_authorization",
    label: "Autorização de trabalho nos EUA",
    placeholder: "Ex.: No, I am not authorized to work in the US",
  },
  {
    key: "requires_sponsorship",
    label: "Precisa de visto/sponsorship?",
    placeholder: "Ex.: No",
  },
  {
    key: "salary_expectation",
    label: "Pretensão salarial",
    placeholder: "Ex.: USD 8,000 / month",
  },
  {
    key: "notice_period",
    label: "Aviso prévio / disponibilidade",
    placeholder: "Ex.: 30 days",
  },
  {
    key: "how_did_you_hear",
    label: "Como conheceu a vaga?",
    placeholder: "Ex.: Company careers page",
  },
  {
    key: "pronouns",
    label: "Pronomes (deixe vazio para não preencher)",
    placeholder: "",
  },
] as const;

export type DefaultAnswerKey = (typeof defaultAnswerFields)[number]["key"];
export type DefaultAnswers = Partial<Record<DefaultAnswerKey, string>>;

export type SearchPreferences = {
  minMonthlyUsd: number | null;
  minAnnualUsd: number | null;
  acceptedContracts: ContractType[];
  acceptedEligibility: EligibilityScope[];
  timezone: string | null;
  maxUtcOffsetDistanceHours: number | null;
  targetSeniorities: TargetSeniority[];
  targetJobFamilies: JobFamily[];
  titleIncludeKeywords: string[];
  titleExcludeKeywords: string[];
  defaultAnswers: DefaultAnswers;
  updatedAt: Date | null;
};

/** Editable fields, as sent by the form (no `updatedAt`). */
export type SearchPreferencesInput = Omit<SearchPreferences, "updatedAt">;

export const emptySearchPreferences: SearchPreferencesInput = {
  minMonthlyUsd: null,
  minAnnualUsd: null,
  acceptedContracts: [],
  acceptedEligibility: [],
  timezone: null,
  maxUtcOffsetDistanceHours: null,
  targetSeniorities: [],
  targetJobFamilies: [],
  titleIncludeKeywords: [],
  titleExcludeKeywords: [],
  defaultAnswers: {},
};

const MAX_KEYWORDS = 60;
const MAX_KEYWORD_LENGTH = 60;
const MAX_ANSWER_LENGTH = 300;

function pickAllowed<T extends string>(
  value: unknown,
  options: ReadonlyArray<{ value: T }>,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<string>(options.map((option) => option.value));

  return [...new Set(value.filter((item): item is T => typeof item === "string" && allowed.has(item)))];
}

/** Splits on commas/newlines, lowercases, trims and dedupes. */
export function normalizeKeywordList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : [];

  return [
    ...new Set(
      raw
        .map((item) => item.trim().toLowerCase().replace(/\s+/g, " "))
        .filter((item) => item.length > 0 && item.length <= MAX_KEYWORD_LENGTH),
    ),
  ].slice(0, MAX_KEYWORDS);
}

function normalizeNonNegativeInt(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.min(Math.round(parsed), max);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function normalizeDefaultAnswers(value: unknown): DefaultAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const answers: DefaultAnswers = {};

  for (const field of defaultAnswerFields) {
    const raw = source[field.key];

    if (typeof raw === "string" && raw.trim()) {
      answers[field.key] = raw.trim().slice(0, MAX_ANSWER_LENGTH);
    }
  }

  return answers;
}

/** Cleans untrusted input (form or stored JSON) into a valid preferences object. */
export function normalizeSearchPreferences(input: unknown): SearchPreferencesInput {
  const source =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const timezone =
    typeof source.timezone === "string" && isValidTimeZone(source.timezone.trim())
      ? source.timezone.trim()
      : null;

  return {
    minMonthlyUsd: normalizeNonNegativeInt(source.minMonthlyUsd, 1_000_000),
    minAnnualUsd: normalizeNonNegativeInt(source.minAnnualUsd, 10_000_000),
    acceptedContracts: pickAllowed(source.acceptedContracts, contractOptions),
    acceptedEligibility: pickAllowed(source.acceptedEligibility, eligibilityOptions),
    timezone,
    maxUtcOffsetDistanceHours: normalizeNonNegativeInt(source.maxUtcOffsetDistanceHours, 12),
    targetSeniorities: pickAllowed(source.targetSeniorities, targetSeniorityOptions),
    targetJobFamilies: pickAllowed(source.targetJobFamilies, jobFamilyOptions),
    titleIncludeKeywords: normalizeKeywordList(source.titleIncludeKeywords),
    titleExcludeKeywords: normalizeKeywordList(source.titleExcludeKeywords),
    defaultAnswers: normalizeDefaultAnswers(source.defaultAnswers),
  };
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export type SearchPreferencesRowLike = {
  minMonthlyUsd: number | null;
  minAnnualUsd: number | null;
  acceptedContracts: string | null;
  acceptedEligibility: string | null;
  timezone: string | null;
  maxUtcOffsetDistanceHours: number | null;
  targetSeniorities: string | null;
  targetJobFamilies: string | null;
  titleIncludeKeywords: string | null;
  titleExcludeKeywords: string | null;
  defaultAnswers: string | null;
  updatedAt: Date;
};

export function searchPreferencesFromRow(row: SearchPreferencesRowLike): SearchPreferences {
  const normalized = normalizeSearchPreferences({
    minMonthlyUsd: row.minMonthlyUsd,
    minAnnualUsd: row.minAnnualUsd,
    acceptedContracts: parseJson(row.acceptedContracts),
    acceptedEligibility: parseJson(row.acceptedEligibility),
    timezone: row.timezone,
    maxUtcOffsetDistanceHours: row.maxUtcOffsetDistanceHours,
    targetSeniorities: parseJson(row.targetSeniorities),
    targetJobFamilies: parseJson(row.targetJobFamilies),
    titleIncludeKeywords: parseJson(row.titleIncludeKeywords),
    titleExcludeKeywords: parseJson(row.titleExcludeKeywords),
    defaultAnswers: parseJson(row.defaultAnswers),
  });

  return { ...normalized, updatedAt: row.updatedAt };
}

/**
 * Annual USD floor. Monthly x 12 and the annual value are both honored; when
 * both exist the lower one wins (the more permissive floor). Null = no floor.
 */
export function getAnnualSalaryFloorUsd(
  preferences: Pick<SearchPreferencesInput, "minMonthlyUsd" | "minAnnualUsd"> | null,
): number | null {
  if (!preferences) {
    return null;
  }

  const candidates = [
    preferences.minAnnualUsd,
    preferences.minMonthlyUsd != null ? preferences.minMonthlyUsd * 12 : null,
  ].filter((value): value is number => value != null && value > 0);

  return candidates.length > 0 ? Math.min(...candidates) : null;
}

/** True when the user has set at least one preference that filters vacancies. */
export function hasActiveSearchFilters(preferences: SearchPreferencesInput | null): boolean {
  if (!preferences) {
    return false;
  }

  return (
    getAnnualSalaryFloorUsd(preferences) != null ||
    preferences.acceptedEligibility.length > 0 ||
    preferences.acceptedContracts.length > 0 ||
    preferences.targetJobFamilies.length > 0 ||
    preferences.titleIncludeKeywords.length > 0 ||
    preferences.titleExcludeKeywords.length > 0
  );
}
