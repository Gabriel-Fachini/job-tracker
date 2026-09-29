import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { SearchPreferencesInput } from "@/lib/search-preferences";

import type { SalaryCandidate, SeniorityValue, TriageJob } from "./types";

/**
 * Lean states for the models. Jev (and small models in general) get worse when
 * the state carries text unrelated to the question, so only the title, the
 * location fields, the sentences that mention location/contract/salary and the
 * intro of the description go in. ~6k tokens at most (about 20k characters).
 */

export const MAX_STATE_CHARS = 20_000;
const INTRO_CHARS = 1_500;
const MAX_SENTENCE_CHARS = 400;
const FIT_DESCRIPTION_CHARS = 6_000;

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
): Record<string, unknown> {
  const intro = (job.description ?? "").replace(/\s+/g, " ").trim().slice(0, INTRO_CHARS);
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
  const budget = Math.max(0, MAX_STATE_CHARS - baseSize - 500);

  state.relevant_sentences = relevantSentences(job.description, budget).filter(
    (sentence) => !intro.includes(sentence),
  );

  return state;
}

/** Stage 2 state: the vacancy text the fit is judged on. */
export function buildFitState(
  job: TriageJob,
  seniority: SeniorityValue | null,
  jobFamily: string | null,
): Record<string, unknown> {
  return {
    title: job.title,
    seniority_estimate: seniority && seniority !== "not_stated" ? seniority : null,
    job_family_estimate: jobFamily && jobFamily !== "other" ? jobFamily : null,
    description: (job.description ?? "").replace(/\n{3,}/g, "\n\n").trim().slice(0, FIT_DESCRIPTION_CHARS),
  };
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
