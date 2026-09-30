import { evalCandidate, evalJobs, evalPreferences, type EvalJob } from "./__fixtures__/eval-jobs";
import { hardFilters } from "./hard-filters";
import { extractSalaryCandidates, toAnnualUsd } from "./salary";
import { buildEligibilityState, buildFitState } from "./state";
import type { TriageEngine } from "./types";

/**
 * Scores a triage engine on the fictional vacancies in `__fixtures__`: stage 0
 * is deterministic (always run), stage 1 answers and the stage 2 red-flag
 * question are compared per question. Used by `npm run triage:eval` to
 * calibrate thresholds; `runTriageEval` takes any engine so tests can inject fakes.
 */

export type QuestionScore = { question: string; correct: number; total: number };

export type EngineEvalResult = {
  engine: string;
  model: string;
  scores: QuestionScore[];
  errors: Array<{ jobId: string; message: string }>;
};

export type Stage0EvalResult = {
  total: number;
  correct: number;
  mismatches: Array<{ jobId: string; expected: string | null; actual: string | null }>;
};

export function evaluateStageZero(jobs: EvalJob[] = evalJobs): Stage0EvalResult {
  const mismatches: Stage0EvalResult["mismatches"] = [];

  for (const { id, job, expected } of jobs) {
    const result = hardFilters(job, evalPreferences);
    const actual = result.pass ? null : result.reason;

    if (actual !== expected.stage0) {
      mismatches.push({ jobId: id, expected: expected.stage0, actual });
    }
  }

  return { total: jobs.length, correct: jobs.length - mismatches.length, mismatches };
}

class Scoreboard {
  private readonly rows = new Map<string, QuestionScore>();

  record(question: string, correct: boolean) {
    const row = this.rows.get(question) ?? { question, correct: 0, total: 0 };

    row.total += 1;
    row.correct += correct ? 1 : 0;
    this.rows.set(question, row);
  }

  toArray() {
    return [...this.rows.values()];
  }
}

export async function runTriageEval(
  engine: TriageEngine,
  jobs: EvalJob[] = evalJobs,
  options: { onProgress?: (jobId: string) => void } = {},
): Promise<EngineEvalResult> {
  const board = new Scoreboard();
  const errors: EngineEvalResult["errors"] = [];

  for (const { id, job, expected } of jobs) {
    // Vacancies stage 0 discards never reach a model.
    if (expected.stage0 !== null) {
      continue;
    }

    options.onProgress?.(id);

    try {
      const candidates = extractSalaryCandidates(job.description);
      const answers = await engine.answerEligibility({
        state: buildEligibilityState(job, candidates),
        families: evalPreferences.targetJobFamilies,
        salaryCandidates: candidates.map(({ id: candidateId, text, context }) => ({ id: candidateId, text, context })),
      });

      if (expected.eligibility) board.record("eligibility", answers.eligibility.value === expected.eligibility);
      if (expected.contract) board.record("contract", answers.contract.value === expected.contract);
      if (expected.seniority) board.record("seniority", answers.seniority.value === expected.seniority);
      if (expected.jobFamily) board.record("job_family", answers.jobFamily.value === expected.jobFamily);
      if (expected.usAuthorizationRequired !== undefined) {
        board.record("us_work_authorization", answers.usWorkAuthorizationRequired > 0.5 === expected.usAuthorizationRequired);
      }

      if (expected.salaryAnnual) {
        const picked = candidates.find((candidate) => candidate.id === answers.salarySpan?.value);
        const range = picked ? toAnnualUsd(picked.parsed) : null;

        board.record("salary_span", range?.min === expected.salaryAnnual.min && range?.max === expected.salaryAnnual.max);
      }

      const fit = await engine.answerFit({
        state: buildFitState(job, answers.seniority.value, answers.jobFamily.value, {
          candidateChars: JSON.stringify(evalCandidate).length,
        }),
        candidate: evalCandidate,
        hasDomainPreference: false,
      });

      board.record("red_flags", fit.redFlags >= 0.5 === (expected.redFlags ?? false));
    } catch (error) {
      errors.push({ jobId: id, message: error instanceof Error ? error.message : "erro desconhecido" });
    }
  }

  return { engine: engine.name, model: engine.model, scores: board.toArray(), errors };
}

export function formatPercent(correct: number, total: number) {
  return total === 0 ? "n/a" : `${Math.round((correct / total) * 100)}%`;
}
