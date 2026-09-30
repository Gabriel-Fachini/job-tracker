import { jobFamilyOptions } from "@/lib/search-preferences";

import {
  contractValues,
  eligibilityValues,
  seniorityValues,
  timezoneValues,
  type ChoiceResult,
  type EligibilityAnswers,
  type EligibilityInput,
  type FitAnswers,
  type FitInput,
  type LevelResult,
} from "../types";

/**
 * What an engine can read from its model's answer. Jev and the JSON engines
 * (OpenAI, Ollama) each implement this; the assembly into `TriageAnswers` is
 * shared, so everything downstream is identical whichever engine answered.
 */
export interface AnswerSource {
  /** The chosen option, or `fallback` (confidence 0) when the answer is missing or not an allowed option. */
  choice<T extends string>(id: string, allowed: readonly T[], fallback: T): ChoiceResult<T>;
  /** Probability (0-1) that the answer is yes; 0.5 when unclear or missing. */
  noul(id: string): number;
  /** Rating on the 1-5 scale, or null when the question was not asked or not answered. */
  level(id: string, levels: number): LevelResult | null;
}

export function assembleEligibility(source: AnswerSource, input: EligibilityInput): EligibilityAnswers {
  // Same list the question offers: the user's families (or all of them) plus "other".
  const baseFamilies: string[] =
    input.families.length > 0 ? input.families : jobFamilyOptions.map((option) => option.value);
  const familyChoices = [...new Set([...baseFamilies, "other"])];
  const hasSalaryQuestion = input.salaryCandidates.length > 0;
  let salarySpan: ChoiceResult<string> | null = null;

  if (hasSalaryQuestion) {
    const ids = input.salaryCandidates.map((candidate) => candidate.id);
    const picked = source.choice("salary_span", [...ids, "none"] as const, "none");

    salarySpan = picked.value === "none" ? null : picked;
  }

  return {
    eligibility: source.choice("eligibility", eligibilityValues, "not_stated"),
    usWorkAuthorizationRequired: source.noul("us_work_authorization_required"),
    contract: source.choice("contract", contractValues, "not_stated"),
    timezone: source.choice("timezone", timezoneValues, "not_stated"),
    seniority: source.choice("seniority", seniorityValues, "not_stated"),
    jobFamily: source.choice(
      "job_family",
      familyChoices,
      "other",
    ),
    salarySpan,
  };
}

const NEUTRAL_LEVEL: LevelResult = { value: 3, confidence: 0 };

export function assembleFit(source: AnswerSource, input: FitInput): FitAnswers {
  return {
    stackMatch: source.level("stack_match", 5) ?? NEUTRAL_LEVEL,
    seniorityMatch: source.level("seniority_match", 5) ?? NEUTRAL_LEVEL,
    domainInterest: input.hasDomainPreference ? (source.level("domain_interest", 5) ?? NEUTRAL_LEVEL) : null,
    redFlags: source.noul("red_flags"),
  };
}
