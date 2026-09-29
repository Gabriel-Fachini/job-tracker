import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { SearchPreferencesInput } from "@/lib/search-preferences";

import type { SalaryCandidate, SeniorityValue, TriageJob } from "./types";

/**
 * Lean states for the models. Jev (and small models in general) get worse when
 * the state carries text unrelated to the question, so only the title, the
 * location fields, the sentences that mention location/contract/salary and the
 * intro of the description go in. The budget is `TRIAGE_MAX_STATE_TOKENS`
 * (default 6000, estimated as characters / 4): self-hosted Jev-compatible
 * checkpoints (Laya) read roughly 768-4000 tokens reliably, so lower it there.
 */

export const DEFAULT_STATE_TOKENS = 6_000;
const CHARS_PER_TOKEN = 4;
/** The state may not use more than this share of the budget on the description intro. */
const INTRO_SHARE = 0.5;
const INTRO_CHARS = 1_500;
const MAX_SENTENCE_CHARS = 400;
const FIT_DESCRIPTION_CHARS = 6_000;

/** Cheap token estimate (characters / 4), enough to respect a budget. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** `TRIAGE_MAX_STATE_TOKENS` (positive integer), default 6000. */
export function getStateTokenBudget(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.TRIAGE_MAX_STATE_TOKENS);

  return Number.isInteger(value) && value > 0 ? value : DEFAULT_STATE_TOKENS;
}

export type StateBudgetOptions = { maxTokens?: number };

const RELEVANT_SENTENCE =
  /\b(?:locat(?:ed|ion)|remote|remotely|anywhere|worldwide|global|time\s?zones?|hours?\s+overlap|overlap|visa|sponsor(?:ship)?|contract(?:or|ors)?|freelanc\w*|employees?|employer\s+of\s+record|\bEOR\b|deel|payroll|w-?2|1099|salary|compensation|pay\b|base\s+pay|reloc\w*|based\s+in|reside|residen\w*|citizen\w*|work\s+authori[sz]ation|authori[sz]ed\s+to\s+work|eligible|countries|country|americas|latam|latin\s+america|brazil|europe|\bEU\b|\bUK\b|\bUS\b|\bUSA\b|apac|emea)\b/i;

/** Sentences of the description that talk about where/how the person works and how they are paid. */
export function relevantSentences(description: string | null | undefined, maxChars: number): string[] {
  if (!description) {
    return [];
  }

  const pieces = description
    .replace(/[*_`#>]/g, " ")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((piece) => piece.replace(/\s+/g, " ").trim())
    .filter((piece) => piece.length > 3);
  const seen = new Set<string>();
  const kept: string[] = [];
  let used = 0;

  for (const piece of pieces) {
    if (!RELEVANT_SENTENCE.test(piece)) {
      continue;
    }

    const sentence = piece.length > MAX_SENTENCE_CHARS ? `${piece.slice(0, MAX_SENTENCE_CHARS)}…` : piece;
    const key = sentence.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    if (used + sentence.length > maxChars) {
      break;
    }

    seen.add(key);
    kept.push(sentence);
    used += sentence.length;
  }

  return kept;
}

/** Stage 1 state: what the model needs to place the vacancy geographically, contractually and by level. */
export function buildEligibilityState(
  job: TriageJob,
  salaryCandidates: SalaryCandidate[],
  options: StateBudgetOptions = {},
): Record<string, unknown> {
  const maxChars = (options.maxTokens ?? getStateTokenBudget()) * CHARS_PER_TOKEN;
  const intro = (job.description ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.min(INTRO_CHARS, Math.floor(maxChars * INTRO_SHARE)));
  const state: Record<string, unknown> = {
    title: job.title,
    location: job.locationText ?? null,
    work_model: job.workModel ?? null,
    salary_text: job.salaryText ?? null,
    description_intro: intro,
  };

  if (job.locationRestrictions?.length) {
    state.location_restrictions = job.locationRestrictions;
  }

  if (job.timezoneRestrictions?.length) {
    state.timezone_offsets_accepted = job.timezoneRestrictions;
  }

  if (salaryCandidates.length > 0) {
    state.salary_candidates = salaryCandidates.map(({ id, text, context }) => ({ id, text, context }));
  }

  const baseSize = JSON.stringify(state).length;
  const budget = Math.max(0, maxChars - baseSize - 60);

  state.relevant_sentences = relevantSentences(job.description, budget).filter(
    (sentence) => !intro.includes(sentence),
  );

  return fitToBudget(state, maxChars);
}

/** Last guard: drops sentences, then halves the intro, until the state fits `maxChars`. */
function fitToBudget(state: Record<string, unknown>, maxChars: number): Record<string, unknown> {
  const sentences = Array.isArray(state.relevant_sentences) ? (state.relevant_sentences as string[]) : [];

  while (JSON.stringify(state).length > maxChars && sentences.length > 0) {
    sentences.pop();
  }

  while (JSON.stringify(state).length > maxChars && typeof state.description_intro === "string" && state.description_intro.length > 40) {
    state.description_intro = state.description_intro.slice(0, Math.floor(state.description_intro.length / 2));
  }

  while (JSON.stringify(state).length > maxChars && Array.isArray(state.salary_candidates) && state.salary_candidates.length > 1) {
    state.salary_candidates = state.salary_candidates.slice(0, -1);
  }

  return state;
}

/** Stage 2 state: the vacancy text the fit is judged on. */
export function buildFitState(
  job: TriageJob,
  seniority: SeniorityValue | null,
  jobFamily: string | null,
  options: StateBudgetOptions & {
    /** Size of the candidate JSON that travels in the same state (Jev). */
    candidateChars?: number;
  } = {},
): Record<string, unknown> {
  const maxChars = (options.maxTokens ?? getStateTokenBudget()) * CHARS_PER_TOKEN;
  const state: Record<string, unknown> = {
    title: job.title,
    seniority_estimate: seniority && seniority !== "not_stated" ? seniority : null,
    job_family_estimate: jobFamily && jobFamily !== "other" ? jobFamily : null,
    description: "",
  };
  const overhead = JSON.stringify(state).length + (options.candidateChars ?? 0) + 60;
  const allowed = Math.max(0, Math.min(FIT_DESCRIPTION_CHARS, maxChars - overhead));

  state.description = (job.description ?? "").replace(/\n{3,}/g, "\n\n").trim().slice(0, allowed);

  return state;
}

// ---- Candidate (no personal data) --------------------------------------

function monthIndex(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? "");

  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

/** Years covered by the experiences (overlaps counted once). */
export function estimateYearsOfExperience(
  experiences: ProfileSnapshot["experiences"],
  now: Date = new Date(),
): number {
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  const intervals = experiences
    .map((experience) => {
      const start = monthIndex(experience.startDate);
      const end = experience.isCurrent ? nowIndex : (monthIndex(experience.endDate) ?? nowIndex);

      return start !== null && end >= start ? ([start, end] as const) : null;
    })
    .filter((interval): interval is readonly [number, number] => interval !== null)
    .sort((left, right) => left[0] - right[0]);

  let months = 0;
  let cursor = -Infinity;

  for (const [start, end] of intervals) {
    const from = Math.max(start, cursor);

    if (end > from) {
      months += end - from;
      cursor = end;
    }
  }

  return Math.round((months / 12) * 10) / 10;
}

export function seniorityFromYears(years: number): SeniorityValue {
  if (years < 2) return "junior";
  if (years < 5) return "mid";
  if (years < 9) return "senior";

  return "staff_plus";
}

/**
 * The candidate as the fit stage sees it: skills, years, seniority, families and
 * the company/values preferences. Never the name, e-mail, phone, links or location.
 */
export function buildCandidateProfile(
  profile: ProfileSnapshot,
  preferences: SearchPreferencesInput | null,
  now: Date = new Date(),
): Record<string, unknown> {
  const years = estimateYearsOfExperience(profile.experiences, now);

  return {
    years_of_experience: years,
    seniority: seniorityFromYears(years),
    target_seniorities: preferences?.targetSeniorities ?? [],
    target_job_families: preferences?.targetJobFamilies ?? [],
    skills: profile.skills.slice(0, 30).map((skill) => ({
      name: skill.name,
      level: skill.level,
      years: skill.yearsExperience,
    })),
    projects_stack: [...new Set(profile.projects.slice(0, 6).flatMap((project) => project.stack))].slice(0, 20),
    company_type_preference: profile.companyTypePreference,
    values_preference: profile.valuesPreference,
  };
}

export function hasDomainPreference(profile: ProfileSnapshot): boolean {
  return Boolean(profile.companyTypePreference?.trim() || profile.valuesPreference?.trim());
}
