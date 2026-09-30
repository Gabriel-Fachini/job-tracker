import {
  getAnnualSalaryFloorUsd,
  type EligibilityScope,
  type JobFamily,
  type SearchPreferencesInput,
} from "@/lib/search-preferences";

import {
  formatAnnualUsdRange,
  parseSalaryText,
  toAnnualUsd,
  toAnnualUsdFromStructured,
  type AnnualUsdRange,
} from "./salary";
import type { DiscardReason, TriageJob } from "./types";

/**
 * Stage 0: pure code, no model. It cuts the volume (thousands of vacancies from
 * imported companies and feeds) and is the last word: a model never promotes a
 * vacancy these rules discarded. Every rule is off when its preference is empty.
 */

export type HardFilterResult =
  | { pass: true; salary: AnnualUsdRange | null }
  | { pass: false; reason: DiscardReason; detail: string; salary: AnnualUsdRange | null };

function normalizeText(value: string): string {
  return ` ${value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()} `;
}

function containsKeyword(normalizedTitle: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);

  return normalizedKeyword.trim().length > 0 && normalizedTitle.includes(normalizedKeyword);
}

const FAMILY_KEYWORDS: Record<JobFamily, string[]> = {
  backend: ["backend", "back-end", "back end", "server-side", "api engineer", "api developer", "node.js", "nodejs", "java engineer", "python engineer", "golang", "go engineer", "rails", "django"],
  fullstack: ["fullstack", "full-stack", "full stack"],
  frontend: ["frontend", "front-end", "front end", "ui engineer", "react", "web developer", "web engineer"],
  data: ["data engineer", "data scientist", "data analyst", "analytics engineer", "etl", "data platform", "bi engineer", "data developer"],
  devops: ["devops", "sre", "site reliability", "infrastructure", "platform engineer", "cloud engineer", "kubernetes", "release engineer", "systems engineer"],
  mobile: ["mobile", "ios", "android", "react native", "flutter", "swift", "kotlin"],
  ai_ml: ["machine learning", "ml engineer", "ai engineer", "llm", "nlp", "deep learning", "applied scientist", "research engineer"],
};

/** A generic developer title fits any family the user picked; the model decides which. */
const GENERIC_ENGINEER_TITLES = [
  "software engineer",
  "software developer",
  "developer",
  "programmer",
  "swe",
  "member of technical staff",
  "software architect",
];

export function familyKeywords(families: JobFamily[]): string[] {
  return [...new Set(families.flatMap((family) => FAMILY_KEYWORDS[family] ?? []))];
}

/** Terms in structured location restrictions that satisfy each accepted scope. */
const LATAM_COUNTRIES = [
  "brazil", "brasil", "argentina", "chile", "colombia", "mexico", "uruguay", "peru", "paraguay",
  "ecuador", "bolivia", "venezuela", "costa rica", "panama", "guatemala", "el salvador", "honduras",
  "nicaragua", "dominican republic", "puerto rico",
];
const SCOPE_TERMS: Record<EligibilityScope, string[]> = {
  worldwide: ["worldwide", "anywhere", "global", "world", "any country", "all countries"],
  americas: ["americas", "the americas", "north america", "south america", "latin america", "latam", "central america", ...LATAM_COUNTRIES],
  latam: ["latin america", "latam", "south america", "central america", ...LATAM_COUNTRIES],
  brazil: ["brazil", "brasil"],
};

export function acceptedLocationTerms(scopes: EligibilityScope[]): string[] {
  return [...new Set(scopes.flatMap((scope) => SCOPE_TERMS[scope]))];
}

function restrictionMatches(restriction: string, terms: string[]): boolean {
  const normalized = normalizeText(restriction);

  return terms.some((term) => normalized.includes(normalizeText(term)));
}

/** High-precision phrases: a vacancy that says this cannot be worked from another country. */
const RESTRICTIVE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /(?<!\bnot\s)(?<!\bnon[- ])\b(?:US|U\.S\.|USA|United States)[- ]only\b/i, label: "US only" },
  { regex: /\bmust\s+(?:be\s+located|reside|be\s+based)\s+in\s+the\s+(?:US|U\.S\.|USA|United States)\b/i, label: "must be located in the US" },
  { regex: /(?<!\bnot\s)(?<!\bnon[- ])\bEU[- ]only\b/i, label: "EU only" },
  { regex: /(?<!\bnot\s)(?<!\bnon[- ])\bUK[- ]only\b/i, label: "UK only" },
  { regex: /(?<!\bnot\s)(?<!\bnon[- ])\b(?:Canada|Europe)[- ]only\b/i, label: "Canada/Europe only" },
];

const US_AUTHORIZATION = /authori[sz]ed\s+to\s+work\s+in\s+the\s+(?:US|U\.S\.|USA|United States)\b/i;
const NO_SPONSORSHIP = /\b(?:without|no)\s+(?:visa\s+)?sponsorship\b|\bwill\s+not\s+(?:be\s+able\s+to\s+)?sponsor\b|\bunable\s+to\s+sponsor\b/i;

export function findRestrictiveLocationPhrase(text: string): string | null {
  for (const { regex, label } of RESTRICTIVE_PATTERNS) {
    if (regex.test(text)) {
      return label;
    }
  }

  if (US_AUTHORIZATION.test(text) && NO_SPONSORSHIP.test(text)) {
    return "authorized to work in the US without sponsorship";
  }

  return null;
}

/** Current UTC offset (hours) of an IANA zone, e.g. America/Sao_Paulo -> -3. Null if unknown. */
export function utcOffsetHours(timeZone: string, at: Date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(at);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const match = /GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(name);

    if (!match) {
      return null;
    }

    if (!match[1]) {
      return 0;
    }

    const sign = match[1] === "-" ? -1 : 1;

    return sign * (Number(match[2]) + Number(match[3] ?? 0) / 60);
  } catch {
    return null;
  }
}

export function hardFilters(
  job: TriageJob,
  preferences: SearchPreferencesInput | null,
  options: { now?: Date } = {},
): HardFilterResult {
  const floor = getAnnualSalaryFloorUsd(preferences);
  const salary =
    toAnnualUsdFromStructured(job.salary) ?? toAnnualUsd(parseSalaryText(job.salaryText));

  if (!preferences) {
    return { pass: true, salary };
  }

  const fail = (reason: DiscardReason, detail: string): HardFilterResult => ({
    pass: false,
    reason,
    detail,
    salary,
  });

  // 1. Title first: it removes most of the volume before anything else is looked at.
  const normalizedTitle = normalizeText(job.title ?? "");
  const excluded = preferences.titleExcludeKeywords.find((keyword) => containsKeyword(normalizedTitle, keyword));

  if (excluded) {
    return fail("job_family_mismatch", `título contém "${excluded}"`);
  }

  const includeKeywords = preferences.titleIncludeKeywords;
  const families = preferences.targetJobFamilies;

  if (includeKeywords.length > 0 || families.length > 0) {
    const accepted = [
      ...includeKeywords,
      ...familyKeywords(families),
      ...(families.length > 0 ? GENERIC_ENGINEER_TITLES : []),
    ];

    if (!accepted.some((keyword) => containsKeyword(normalizedTitle, keyword))) {
      return fail("job_family_mismatch", "título fora das áreas alvo");
    }
  }

  // 2. Location: structured restrictions, then high-precision phrases.
  if (preferences.acceptedEligibility.length > 0) {
    const restrictions = (job.locationRestrictions ?? []).filter(Boolean);
    const terms = acceptedLocationTerms(preferences.acceptedEligibility);

    if (restrictions.length > 0 && !restrictions.some((restriction) => restrictionMatches(restriction, terms))) {
      return fail("location_ineligible", `restrito a ${restrictions.slice(0, 4).join(", ")}`);
    }

    const phrase = findRestrictiveLocationPhrase(`${job.title ?? ""}\n${job.locationText ?? ""}\n${job.description ?? ""}`);

    if (phrase) {
      return fail("location_ineligible", `texto diz "${phrase}"`);
    }
  }

  // 3. Time zone distance, only when the source lists the accepted offsets.
  if (
    preferences.timezone &&
    preferences.maxUtcOffsetDistanceHours !== null &&
    (job.timezoneRestrictions?.length ?? 0) > 0
  ) {
    const mine = utcOffsetHours(preferences.timezone, options.now);

    if (
      mine !== null &&
      !(job.timezoneRestrictions as number[]).some(
        (offset) => Math.abs(offset - mine) <= (preferences.maxUtcOffsetDistanceHours as number),
      )
    ) {
      return fail("location_ineligible", "fuso horário fora da distância aceita");
    }
  }

  // 4. Salary: only a known USD figure can discard (other currencies pass).
  if (floor !== null && salary && salary.max < floor) {
    return fail(
      "salary_below_min",
      `${formatAnnualUsdRange(salary)} abaixo do mínimo de ${formatAnnualUsdRange({ min: floor, max: floor })}`,
    );
  }

  return { pass: true, salary };
}
