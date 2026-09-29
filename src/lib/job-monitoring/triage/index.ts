import { getTypeSafeConfig, TypeSafeConfigurationError } from "@/lib/ai/typesafe";
import { OpenAiComparisonConfigurationError } from "@/lib/ai/openai";
import type { SearchPreferencesInput } from "@/lib/search-preferences";

import type { JobLeadClassification } from "../types";
import { createJevEngine } from "./engines/jev";
import { createOllamaEngine, createOpenAiEngine } from "./engines/json-engine";
import { hardFilters } from "./hard-filters";
import {
  buildReason,
  buildSignals,
  computeFit,
  evaluateStageOne,
  FIT_WEIGHTS,
  overallConfidence,
  TRIAGE_THRESHOLDS,
} from "./rules";
import { extractSalaryCandidates } from "./salary";
import {
  buildCandidateProfile,
  buildEligibilityState,
  buildFitState,
  hasDomainPreference,
} from "./state";
import {
  emptyTriageFields,
  type EligibilityAnswers,
  type FitAnswers,
  type TriageContext,
  type TriageEngine,
  type TriageEngineName,
  type TriageFields,
  type TriageJob,
  type TriageResult,
} from "./types";

export * from "./types";

export class TriageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TriageConfigurationError";
  }
}

export class TriageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TriageError";
  }
}

/** `TRIAGE_ENGINE`: `openai` (default) | `jev` | `ollama`. Anything else is a configuration error. */
export function getTriageEngineName(env: Record<string, string | undefined> = process.env): TriageEngineName {
  const value = env.TRIAGE_ENGINE?.trim().toLowerCase();

  if (!value || value === "openai") return "openai";
  if (value === "jev" || value === "ollama") return value;

  throw new TriageConfigurationError(
    `TRIAGE_ENGINE inválido: "${env.TRIAGE_ENGINE}". Use openai, jev ou ollama.`,
  );
}

/**
 * Builds the engine or fails closed with a clear message: `openai` without
 * `OPENAI_API_KEY`, `jev` without `TYPESAFE_API_KEY`, `ollama` without its config.
 */
export function createTriageEngine(env: Record<string, string | undefined> = process.env): TriageEngine {
  const name = getTriageEngineName(env);

  try {
    if (name === "jev") return createJevEngine({ config: getTypeSafeConfig(env) });
    if (name === "ollama") return createOllamaEngine();

    return createOpenAiEngine({ env });
  } catch (error) {
    if (
      error instanceof TypeSafeConfigurationError ||
      error instanceof OpenAiComparisonConfigurationError ||
      (error instanceof Error && error.name === "OllamaConfigurationError")
    ) {
      throw new TriageConfigurationError(`Triagem (${name}): ${error.message}`);
    }

    throw error;
  }
}

/** Throws when the configured engine cannot start. Called before a run so it fails once, clearly. */
export function assertTriageConfigured(env: Record<string, string | undefined> = process.env): void {
  createTriageEngine(env);
}

let cachedEngine: { key: string; engine: TriageEngine } | null = null;

function engineFromEnv(): TriageEngine {
  const key = [
    process.env.TRIAGE_ENGINE,
    process.env.OPENAI_TRIAGE_MODEL,
    process.env.OPENAI_API_KEY,
    process.env.TYPESAFE_API_KEY,
    process.env.TYPESAFE_MODEL,
    process.env.OLLAMA_MODEL,
  ].join("|");

  if (!cachedEngine || cachedEngine.key !== key) {
    cachedEngine = { key, engine: createTriageEngine() };
  }

  return cachedEngine.engine;
}

const CONTRACT_TYPES: Record<string, string[] | null> = {
  contractor_or_eor_ok: ["contractor", "eor"],
  employee_only: ["employee"],
  not_stated: null,
};

function baseFields(
  engine: TriageFields["triageEngine"],
  model: string | null,
): TriageFields {
  const fields = emptyTriageFields(engine);
  fields.triageModel = model;

  return fields;
}

function stageOneFields(
  answers: EligibilityAnswers,
  fields: TriageFields,
  salary: { min: number; max: number } | null,
) {
  fields.eligibility = answers.eligibility.value;
  fields.contractTypes = CONTRACT_TYPES[answers.contract.value] ?? null;
  fields.salaryMinUsdAnnual = salary?.min ?? null;
  fields.salaryMaxUsdAnnual = salary?.max ?? null;
}

function serializeAnswers(answers: EligibilityAnswers) {
  return {
    eligibility: answers.eligibility,
    usWorkAuthorizationRequired: answers.usWorkAuthorizationRequired,
    contract: answers.contract,
    timezone: answers.timezone,
    seniority: answers.seniority,
    jobFamily: answers.jobFamily,
    salarySpan: answers.salarySpan,
  };
}

export type TriageDependencies = {
  /** Defaults to the engine `TRIAGE_ENGINE` selects (failing closed when it is not configured). */
  engine?: TriageEngine;
};

/**
 * Three stages, one contract for the persistence and the UI (`decision`, `score`,
 * `reason`, signals) plus the new triage fields:
 *
 * 0. hard filters (code only), never overridden by a model;
 * 1. eligibility/contract/timezone/seniority/family/salary extraction (model), then code rules;
 * 2. fit (model) and a composite score decided in code.
 *
 * Without a saved profile nothing after stage 0 calls a model (review, score 40).
 */
export async function triageJob(
  job: TriageJob,
  context: TriageContext,
  dependencies: TriageDependencies = {},
): Promise<TriageResult> {
  const preferences: SearchPreferencesInput | null = context.preferences ?? null;

  // ---- Stage 0 -------------------------------------------------------------
  const hard = hardFilters(job, preferences);

  if (!hard.pass) {
    const fields = baseFields("rules", null);
    fields.discardReason = hard.reason;
    fields.salaryMinUsdAnnual = hard.salary?.min ?? null;
    fields.salaryMaxUsdAnnual = hard.salary?.max ?? null;
    fields.triageConfidence = 1;
    fields.triageDetails = { stage: 0, hardFilter: { reason: hard.reason, detail: hard.detail } };

    return {
      classification: {
        decision: "discarded",
        score: 0,
        reason: `${discardPhrase(hard.reason)} (${hard.detail}).`,
        matchedSignals: [],
        riskSignals: [hard.detail],
        missingSignals: [],
      },
      fields,
    };
  }

  // ---- No profile: same as the old classifier, no model call ---------------------
  const profile = context.profile;

  if (!profile) {
    const fields = baseFields("rules", null);
    fields.salaryMinUsdAnnual = hard.salary?.min ?? null;
    fields.salaryMaxUsdAnnual = hard.salary?.max ?? null;
    fields.triageDetails = { stage: 0, note: "no-profile" };

    return {
      classification: {
        decision: "review",
        score: 40,
        reason: "Perfil principal ainda nao foi configurado para classificar com confianca.",
        matchedSignals: [],
        riskSignals: [],
        missingSignals: ["Perfil principal indisponivel"],
      },
      fields,
    };
  }

  const engine = dependencies.engine ?? engineFromEnv();
  const fields = baseFields(engine.name, engine.model);
  const families = preferences?.targetJobFamilies ?? [];

  // ---- Stage 1 -------------------------------------------------------------
  // A salary the source or the text already states in USD needs no model: skip the salary question.
  const candidates = hard.salary ? [] : extractSalaryCandidates(job.description);
  let answers: EligibilityAnswers;

  try {
    answers = await engine.answerEligibility({
      state: buildEligibilityState(job, candidates),
      families,
      salaryCandidates: candidates.map(({ id, text, context: window }) => ({ id, text, context: window })),
    });
  } catch (error) {
    throw new TriageError(errorMessage(error, `Falha na triagem (${engine.name}, extração).`));
  }

  const stageOne = evaluateStageOne({
    answers,
    preferences,
    salaryFromSource: hard.salary,
    salaryCandidates: candidates,
  });

  stageOneFields(answers, fields, stageOne.salary);

  const details: Record<string, unknown> = {
    stage: 1,
    engine: engine.name,
    model: engine.model,
    thresholds: TRIAGE_THRESHOLDS,
    stageOne: {
      answers: serializeAnswers(answers),
      salary: stageOne.salary,
      salarySource: stageOne.salarySource,
      forceReview: stageOne.forceReview,
    },
  };

  if (stageOne.discard) {
    fields.discardReason = stageOne.discard.reason;
    fields.triageConfidence = answers.eligibility.confidence;
    fields.triageDetails = { ...details, discard: stageOne.discard };

    return {
      classification: {
        decision: "discarded",
        score: 0,
        reason: `${buildReason({ answers, salary: stageOne.salary, fit: null, discard: stageOne.discard, forceReview: [] })}.`,
        ...buildSignals({ answers, salary: stageOne.salary, fit: null }),
      },
      fields,
    };
  }

  // ---- Stage 2 -------------------------------------------------------------
  const domain = hasDomainPreference(profile);
  let fit: FitAnswers;

  try {
    const candidate = buildCandidateProfile(profile, preferences);

    fit = await engine.answerFit({
      // Jev reads job and candidate as one state: the description gets what the candidate leaves of the budget.
      state: buildFitState(job, answers.seniority.value, answers.jobFamily.value, {
        candidateChars: JSON.stringify(candidate).length,
      }),
      candidate,
      hasDomainPreference: domain,
    });
  } catch (error) {
    throw new TriageError(errorMessage(error, `Falha na triagem (${engine.name}, encaixe).`));
  }

  const outcome = computeFit(fit, stageOne.forceReview);

  fields.discardReason = outcome.decision === "discarded" ? outcome.discardReason : null;
  fields.triageConfidence = overallConfidence(answers.eligibility, outcome);
  fields.triageDetails = {
    ...details,
    stage: 2,
    stageTwo: {
      answers: fit,
      weights: outcome.weights,
      nominalWeights: FIT_WEIGHTS,
      score: outcome.score,
      forceReview: outcome.forceReview,
    },
  };

  const classification: JobLeadClassification = {
    decision: outcome.decision,
    score: outcome.score,
    reason: `${buildReason({
      answers,
      salary: stageOne.salary,
      fit,
      discard: outcome.decision === "discarded" && outcome.discardReason ? { reason: outcome.discardReason, detail: "encaixe" } : null,
      forceReview: outcome.decision === "review" ? outcome.forceReview : [],
    })}.`,
    ...buildSignals({ answers, salary: stageOne.salary, fit }),
  };

  return { classification, fields };
}

function discardPhrase(reason: string) {
  switch (reason) {
    case "location_ineligible":
      return "Descartada: local inelegível";
    case "salary_below_min":
      return "Descartada: salário abaixo do mínimo";
    case "job_family_mismatch":
      return "Descartada: área da vaga fora do alvo";
    default:
      return "Descartada";
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
