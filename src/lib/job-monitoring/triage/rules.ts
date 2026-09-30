import type { SearchPreferencesInput } from "@/lib/search-preferences";
import { getAnnualSalaryFloorUsd } from "@/lib/search-preferences";

import { ELIGIBILITY_LABELS } from "./labels";

import type { JobLeadClassification } from "../types";
import {
  formatAnnualUsdRange,
  toAnnualUsd,
  type AnnualUsdRange,
  type ExtractedSalaryCandidate,
} from "./salary";
import {
  openEligibilityValues,
  restrictedEligibilityValues,
  type ChoiceResult,
  type DiscardReason,
  type EligibilityAnswers,
  type EligibilityValue,
  type FitAnswers,
  type LevelResult,
  type SeniorityValue,
} from "./types";

/**
 * Decision rules of the triage, all in code (the model answers questions, code
 * decides). Thresholds are constants so they can be calibrated with
 * `npm run triage:eval` once a Jev key exists.
 */
export const TRIAGE_THRESHOLDS = {
  /** A restricted eligibility answer discards only at or above this confidence; below it the lead goes to review. */
  eligibilityDiscardConfidence: 0.8,
  /** Same bar for contract, seniority and family mismatches. */
  mismatchDiscardConfidence: 0.8,
  /** `employee_only` + US authorization probability above this = contract mismatch. */
  usAuthorizationProbability: 0.7,
  /** A decisive fit answer below this confidence forces review instead of promoting or discarding. */
  lowConfidence: 0.6,
  /** Red-flag probability: at or above `discard` the lead is discarded, at or above `review` it is capped at review. */
  redFlagDiscard: 0.85,
  redFlagReview: 0.5,
  redFlagScorePenalty: 25,
  /** Composite score bands: >= interesting, >= review (else discarded as low_fit). */
  interestingMinScore: 70,
  reviewMinScore: 30,
} as const;

/** Composite weights (sum = 1). Without a domain preference, stack and seniority are renormalized. */
export const FIT_WEIGHTS = { stack: 0.45, seniority: 0.3, domain: 0.25 } as const;

export type StageOneOutcome = {
  discard: { reason: DiscardReason; detail: string } | null;
  /** Reasons the lead must not be promoted or discarded on the model's word alone. */
  forceReview: string[];
  salary: AnnualUsdRange | null;
  /** Where the salary came from: the source/regex before the model, or the candidate the model picked. */
  salarySource: "source" | "model" | null;
};

const SENIORITY_RANK: Partial<Record<SeniorityValue, number>> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  staff_plus: 4,
};

const TARGET_SENIORITY_RANK: Record<string, number> = { junior: 1, mid: 2, senior: 3, staff_plus: 4 };

function familyCompatible(answer: string, targets: string[]): boolean {
  if (targets.includes(answer)) {
    return true;
  }

  // Full-stack overlaps back-end and front-end work both ways.
  if (answer === "fullstack") {
    return targets.includes("backend") || targets.includes("frontend");
  }

  if (answer === "backend" || answer === "frontend") {
    return targets.includes("fullstack");
  }

  return false;
}

function seniorityCompatible(answer: SeniorityValue, targets: string[]): boolean {
  if (answer === "not_stated") {
    return true;
  }

  const rank = SENIORITY_RANK[answer];

  // Interns and managers are outside every target level.
  if (rank === undefined) {
    return false;
  }

  return targets.some((target) => {
    const targetRank = TARGET_SENIORITY_RANK[target];

    return targetRank !== undefined && Math.abs(targetRank - rank) <= 1;
  });
}

/** Applies the code rules to the stage 1 answers. `salaryFromSource` is the stage 0 figure (source or regex). */
export function evaluateStageOne(input: {
  answers: EligibilityAnswers;
  preferences: SearchPreferencesInput | null;
  salaryFromSource: AnnualUsdRange | null;
  salaryCandidates: ExtractedSalaryCandidate[];
  /**
   * True only for engines whose confidence is calibrated (Jev). Self-reported confidence
   * (OpenAI, Ollama) is logged but never used to discard: there, an auto-discard needs an
   * explicit answer, and doubtful mismatches go to review.
   */
  calibrated?: boolean;
}): StageOneOutcome {
  const { answers, preferences } = input;
  const calibrated = input.calibrated ?? true;
  const t = TRIAGE_THRESHOLDS;
  const forceReview: string[] = [];
  let discard: StageOneOutcome["discard"] = null;

  // Salary: the source's figure wins; otherwise the candidate the model picked, converted in code.
  let salary = input.salaryFromSource;
  let salarySource: StageOneOutcome["salarySource"] = salary ? "source" : null;

  if (!salary && answers.salarySpan) {
    const picked = input.salaryCandidates.find((candidate) => candidate.id === answers.salarySpan?.value);
    const converted = picked ? toAnnualUsd(picked.parsed) : null;

    if (converted) {
      salary = converted;
      salarySource = "model";
    }
  }

  // 1. Eligibility.
  const eligibility = answers.eligibility;

  if (restrictedEligibilityValues.has(eligibility.value)) {
    // Uncalibrated engines: the explicit restricted answer is enough (their confidence label is not).
    if (!calibrated || eligibility.confidence >= t.eligibilityDiscardConfidence) {
      discard = { reason: "location_ineligible", detail: eligibility.value };
    } else {
      forceReview.push("elegibilidade restrita com pouca confiança");
    }
  } else if (eligibility.value === "not_stated") {
    forceReview.push("elegibilidade não informada");
  } else if (calibrated && eligibility.confidence < t.lowConfidence) {
    forceReview.push("elegibilidade incerta");
  }

  // 2. Contract.
  if (!discard) {
    const contract = answers.contract;
    const wantsNoEmployee =
      Boolean(preferences?.acceptedContracts.length) && !preferences?.acceptedContracts.includes("employee");
    const usAuth = answers.usWorkAuthorizationRequired > t.usAuthorizationProbability;

    if (contract.value === "employee_only" && (usAuth || wantsNoEmployee)) {
      const explicit = calibrated
        ? contract.confidence >= t.mismatchDiscardConfidence || (usAuth && contract.confidence >= t.lowConfidence)
        : usAuth;

      if (explicit) {
        discard = {
          reason: "contract_mismatch",
          detail: usAuth ? "só empregado com autorização de trabalho nos EUA" : "só empregado direto",
        };
      } else {
        forceReview.push("contrato só para empregado com pouca confiança");
      }
    }
  }

  // 3. Salary below the floor (a figure the source did not carry but the text did).
  const floor = getAnnualSalaryFloorUsd(preferences);

  if (!discard && floor !== null && salary && salary.max < floor) {
    discard = { reason: "salary_below_min", detail: formatAnnualUsdRange(salary) };
  }

  // 4. Seniority and family, against the targets the user set.
  if (!discard && preferences?.targetSeniorities.length) {
    const seniority = answers.seniority;

    if (!seniorityCompatible(seniority.value, preferences.targetSeniorities)) {
      if (calibrated && seniority.confidence >= t.mismatchDiscardConfidence) {
        discard = { reason: "seniority_mismatch", detail: seniority.value };
      } else {
        forceReview.push("senioridade fora do alvo com pouca confiança");
      }
    }
  }

  if (!discard && preferences?.targetJobFamilies.length) {
    const family = answers.jobFamily;

    if (!familyCompatible(family.value, preferences.targetJobFamilies)) {
      if (calibrated && family.confidence >= t.mismatchDiscardConfidence) {
        discard = { reason: "job_family_mismatch", detail: family.value };
      } else {
        forceReview.push("área da vaga fora do alvo com pouca confiança");
      }
    }
  }

  return { discard, forceReview, salary, salarySource };
}

export type FitOutcome = {
  score: number;
  decision: JobLeadClassification["decision"];
  discardReason: DiscardReason | null;
  forceReview: string[];
  redFlagPenalty: boolean;
  weights: { stack: number; seniority: number; domain: number };
  /** The confidence the decision rests on (lowest of the fit answers). */
  confidence: number;
};

function normalizeLevel(level: LevelResult): number {
  return Math.min(1, Math.max(0, (level.value - 1) / 4));
}

/** Composite score (0-100) from the 1-5 fit ratings and the red-flag probability. */
export function computeFit(
  fit: FitAnswers,
  stageOneForceReview: string[] = [],
  options: {
    /** See `evaluateStageOne`: uncalibrated confidence never forces a review here. */
    calibrated?: boolean;
    /** False when stage 1 found no level in the posting: the seniority match is then neutral. */
    seniorityStated?: boolean;
  } = {},
): FitOutcome {
  const t = TRIAGE_THRESHOLDS;
  const calibrated = options.calibrated ?? true;
  const seniorityStated = options.seniorityStated ?? true;
  const hasDomain = fit.domainInterest !== null;
  const weights = hasDomain
    ? { ...FIT_WEIGHTS }
    : {
        stack: FIT_WEIGHTS.stack / (FIT_WEIGHTS.stack + FIT_WEIGHTS.seniority),
        seniority: FIT_WEIGHTS.seniority / (FIT_WEIGHTS.stack + FIT_WEIGHTS.seniority),
        domain: 0,
      };
  // Models often say "not stated" for titles like "Backend Engineer": that is neutral, not a mismatch.
  const seniorityLevel: LevelResult = seniorityStated ? fit.seniorityMatch : { value: 3, confidence: 1 };

  let composite =
    normalizeLevel(fit.stackMatch) * weights.stack +
    normalizeLevel(seniorityLevel) * weights.seniority +
    (fit.domainInterest ? normalizeLevel(fit.domainInterest) * weights.domain : 0);
  let score = Math.round(composite * 100);
  const forceReview = [...stageOneForceReview];
  const redFlagPenalty = fit.redFlags >= t.redFlagReview;

  if (redFlagPenalty) {
    score = Math.max(0, score - t.redFlagScorePenalty);
    forceReview.push("possíveis sinais de alerta na vaga");
  }

  composite = score / 100;

  const confidences = [fit.stackMatch.confidence, seniorityLevel.confidence];

  if (fit.domainInterest) {
    confidences.push(fit.domainInterest.confidence);
  }

  const confidence = Math.min(...confidences);

  let decision: JobLeadClassification["decision"];
  let discardReason: DiscardReason | null = null;

  if (fit.redFlags >= t.redFlagDiscard) {
    decision = "discarded";
    discardReason = "other";
  } else if (score >= t.interestingMinScore) {
    decision = "interesting";
  } else if (score >= t.reviewMinScore) {
    decision = "review";
  } else {
    decision = "discarded";
    discardReason = "low_fit";
  }

  // The project prefers review to a wrong discard or a wrong promotion: a decisive answer the model is unsure of,
  // or an open question from stage 1, keeps the lead in the human's hands.
  if (decision !== "review" && discardReason !== "other") {
    if (calibrated && confidence < t.lowConfidence) {
      forceReview.push("resposta decisiva com pouca confiança");
    }

    if (forceReview.length > 0) {
      decision = "review";
      discardReason = null;
    }
  }

  return { score, decision, discardReason, forceReview, redFlagPenalty, weights, confidence };
}

// ---- pt-BR reason ----------------------------------------------------------

const SENIORITY_LABELS: Record<SeniorityValue, string> = {
  intern: "estágio",
  junior: "júnior",
  mid: "pleno",
  senior: "sênior",
  staff_plus: "staff+",
  manager: "gestão",
  not_stated: "nível não informado",
};

const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function formatConfidence(value: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function stackLabel(level: LevelResult): string {
  const strength = level.value >= 4 ? "forte" : level.value >= 3 ? "razoável" : "fraca";

  return `stack ${strength} (${decimal.format(level.value)}/5)`;
}

const DISCARD_PHRASES: Record<DiscardReason, string> = {
  location_ineligible: "Descartada: local inelegível",
  salary_below_min: "Descartada: salário abaixo do mínimo",
  job_family_mismatch: "Descartada: área da vaga fora do alvo",
  seniority_mismatch: "Descartada: senioridade fora do alvo",
  contract_mismatch: "Descartada: contrato incompatível",
  low_fit: "Descartada: pouco aderente ao perfil",
  other: "Descartada",
};

export function buildReason(input: {
  answers: EligibilityAnswers;
  salary: AnnualUsdRange | null;
  fit: FitAnswers | null;
  discard: { reason: DiscardReason; detail: string } | null;
  forceReview: string[];
}): string {
  const { answers, salary, fit, discard, forceReview } = input;
  const parts: string[] = [];

  if (discard) {
    parts.push(`${DISCARD_PHRASES[discard.reason]} (${discard.detail})`);
  }

  const eligibility = answers.eligibility;

  if (eligibility.value === "not_stated") {
    parts.push("Elegibilidade não informada");
  } else if (openEligibilityValues.has(eligibility.value)) {
    parts.push(`Elegível: ${ELIGIBILITY_LABELS[eligibility.value]} (${formatConfidence(eligibility.confidence)})`);
  } else {
    parts.push(`Restrita: ${ELIGIBILITY_LABELS[eligibility.value]} (${formatConfidence(eligibility.confidence)})`);
  }

  if (answers.contract.value === "contractor_or_eor_ok") {
    parts.push("contractor ok");
  } else if (answers.contract.value === "employee_only") {
    parts.push("só empregado");
  }

  if (answers.seniority.value !== "not_stated") {
    parts.push(SENIORITY_LABELS[answers.seniority.value]);
  }

  if (fit) {
    parts.push(stackLabel(fit.stackMatch));

    if (fit.redFlags >= TRIAGE_THRESHOLDS.redFlagReview) {
      parts.push("sinais de alerta");
    }
  }

  parts.push(salary ? formatAnnualUsdRange(salary) : "salário não informado");

  if (!discard && forceReview.length > 0) {
    parts.push(`revisar: ${forceReview.join("; ")}`);
  }

  return parts.join(" · ");
}

export function buildSignals(input: {
  answers: EligibilityAnswers;
  salary: AnnualUsdRange | null;
  fit: FitAnswers | null;
}): Pick<JobLeadClassification, "matchedSignals" | "riskSignals" | "missingSignals"> {
  const { answers, salary, fit } = input;
  const matchedSignals: string[] = [];
  const riskSignals: string[] = [];
  const missingSignals: string[] = [];

  if (openEligibilityValues.has(answers.eligibility.value)) {
    matchedSignals.push(`Elegível: ${ELIGIBILITY_LABELS[answers.eligibility.value]}`);
  } else if (answers.eligibility.value === "not_stated") {
    missingSignals.push("Elegibilidade geográfica não informada");
  } else {
    riskSignals.push(`Restrição geográfica: ${ELIGIBILITY_LABELS[answers.eligibility.value]}`);
  }

  if (answers.contract.value === "contractor_or_eor_ok") matchedSignals.push("Aceita contractor/EOR");
  if (answers.contract.value === "employee_only") riskSignals.push("Só empregado direto");
  if (answers.contract.value === "not_stated") missingSignals.push("Tipo de contrato não informado");
  if (!salary) missingSignals.push("Faixa salarial em US$ não informada");

  if (fit) {
    if (fit.stackMatch.value >= 4) matchedSignals.push("Stack em comum forte");
    else if (fit.stackMatch.value < 3) riskSignals.push("Pouca sobreposição de stack");
    if (fit.seniorityMatch.value >= 4) matchedSignals.push("Senioridade próxima do perfil");
    else if (fit.seniorityMatch.value < 3) riskSignals.push("Senioridade distante do perfil");
    if (fit.redFlags >= TRIAGE_THRESHOLDS.redFlagReview) riskSignals.push("Possíveis sinais de alerta (comissão, não remunerado...)");
  }

  return { matchedSignals, riskSignals, missingSignals };
}

/** The lowest confidence among the answers a decision rests on (stage 1 eligibility, stage 2 fit). */
export function overallConfidence(eligibility: ChoiceResult<EligibilityValue>, fit: FitOutcome | null): number {
  return Math.min(eligibility.confidence, fit?.confidence ?? 1);
}
