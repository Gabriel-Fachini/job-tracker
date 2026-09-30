import assert from "node:assert/strict";
import test from "node:test";

import { evalJobs, type EvalJob } from "./__fixtures__/eval-jobs";
import { evaluateStageZero, formatPercent, runTriageEval } from "./eval";
import type { EligibilityAnswers, FitAnswers, TriageEngine } from "./types";

function findByIntro(intro: unknown): EvalJob {
  const found = evalJobs.find((item) => (item.job.description ?? "").replace(/\s+/g, " ").trim() === intro);

  assert.ok(found, "fixture not found for the state the engine received");
  return found;
}

/** An engine that answers exactly what the fixtures expect. */
const oracle: TriageEngine = {
  name: "openai",
  model: "oracle",
  async answerEligibility(input) {
    const { expected } = findByIntro(input.state.description_intro);
    const choice = <T extends string>(value: T | undefined, fallback: T) => ({ value: value ?? fallback, confidence: 0.95 });
    const answers: EligibilityAnswers = {
      eligibility: choice(expected.eligibility, "not_stated"),
      usWorkAuthorizationRequired: expected.usAuthorizationRequired ? 0.95 : 0.05,
      contract: choice(expected.contract, "not_stated"),
      timezone: choice(undefined, "not_stated"),
      seniority: choice(expected.seniority, "not_stated"),
      jobFamily: choice(expected.jobFamily, "other"),
      salarySpan: null,
    };

    if (expected.salaryAnnual && input.salaryCandidates.length > 0) {
      // The right candidate is the first one that carries the expected base pay.
      answers.salarySpan = { value: input.salaryCandidates[0].id, confidence: 0.9 };
    }

    return answers;
  },
  async answerFit(input) {
    const flagged = Boolean(evalJobs.find((item) => item.job.description?.trim() === input.state.description && item.expected.redFlags));
    const fit: FitAnswers = {
      stackMatch: { value: 3, confidence: 0.9 },
      seniorityMatch: { value: 3, confidence: 0.9 },
      domainInterest: null,
      redFlags: flagged ? 0.95 : 0.02,
    };

    return fit;
  },
};

test("the fixtures cover 20+ fictional vacancies and stage 0 scores 100% on them", () => {
  assert.ok(evalJobs.length >= 20);

  const stage0 = evaluateStageZero();

  assert.deepEqual(stage0.mismatches, []);
  assert.equal(stage0.correct, stage0.total);
});

test("runTriageEval scores an engine per question and skips vacancies stage 0 discards", async () => {
  const seen: string[] = [];
  const result = await runTriageEval(oracle, evalJobs, { onProgress: (id) => seen.push(id) });

  assert.equal(result.engine, "openai");
  assert.deepEqual(result.errors, []);
  assert.equal(seen.length, evalJobs.filter((item) => item.expected.stage0 === null).length);
  assert.ok(!seen.some((id) => id.startsWith("02-") || id.startsWith("03-")));

  const byQuestion = new Map(result.scores.map((score) => [score.question, score]));

  for (const question of ["eligibility", "contract", "seniority", "job_family", "us_work_authorization", "salary_span", "red_flags"]) {
    assert.ok(byQuestion.has(question), question);
  }

  // The oracle picks the first salary candidate: right for #17-style bases, and it is what the fixtures encode.
  for (const score of result.scores) {
    if (score.question !== "salary_span") {
      assert.equal(score.correct, score.total, `${score.question} ${score.correct}/${score.total}`);
    }
  }
});

test("a wrong engine scores lower and errors are collected, not thrown", async () => {
  const wrong: TriageEngine = {
    ...oracle,
    model: "wrong",
    async answerEligibility(input) {
      const answers = await oracle.answerEligibility(input);

      return { ...answers, eligibility: { value: "us_only", confidence: 0.9 } };
    },
  };
  const result = await runTriageEval(wrong, evalJobs);
  const eligibility = result.scores.find((score) => score.question === "eligibility");

  assert.ok(eligibility && eligibility.correct < eligibility.total);

  const failing: TriageEngine = {
    ...oracle,
    async answerEligibility() {
      throw new Error("HTTP 500");
    },
  };
  const failed = await runTriageEval(failing, evalJobs.slice(0, 1));

  assert.equal(failed.errors.length, 1);
  assert.equal(failed.errors[0].message, "HTTP 500");
});

test("formatPercent handles empty totals", () => {
  assert.equal(formatPercent(3, 4), "75%");
  assert.equal(formatPercent(0, 0), "n/a");
});
