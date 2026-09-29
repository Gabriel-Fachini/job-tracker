import {
  evaluateSystemOne,
  getTypeSafeConfig,
  type EvaluateOptions,
  type TypeSafeAnswer,
  type TypeSafeConfig,
} from "@/lib/ai/typesafe";

import {
  buildEligibilityQuestions,
  buildFitQuestions,
  toTypeSafeQuestions,
} from "../questions";
import type { EligibilityInput, FitInput, TriageEngine } from "../types";
import { assembleEligibility, assembleFit, type AnswerSource } from "./assemble";

/** Reads answers from a TypeSafe (Jev) response: calibrated probabilities and confidences. */
export function jevAnswerSource(answers: Record<string, TypeSafeAnswer>): AnswerSource {
  return {
    choice(id, allowed, fallback) {
      const answer = answers[id];

      if (answer?.type !== "choice" || !(allowed as readonly string[]).includes(answer.choice)) {
        return { value: fallback, confidence: 0 };
      }

      return {
        value: answer.choice as (typeof allowed)[number],
        confidence: answer.confidence,
        probabilities: answer.probabilities,
      };
    },
    noul(id) {
      const answer = answers[id];

      return answer?.type === "noul" ? answer.noul : 0.5;
    },
    level(id) {
      const answer = answers[id];

      if (answer?.type !== "score") {
        return null;
      }

      // Jev's score is 0-based (probability-weighted level index); the rules use 1-5.
      return { value: answer.score + 1, confidence: answer.confidence };
    },
  };
}

export type JevEngineOptions = {
  config?: TypeSafeConfig;
  fetchImpl?: typeof fetch;
  sleep?: EvaluateOptions["sleep"];
  onUsage?: EvaluateOptions["onUsage"];
};

/** Fails closed (TypeSafeConfigurationError) when `TYPESAFE_API_KEY` is missing. */
export function createJevEngine(options: JevEngineOptions = {}): TriageEngine {
  const config = options.config ?? getTypeSafeConfig();

  async function call(
    label: string,
    state: Record<string, unknown>,
    questions: ReturnType<typeof toTypeSafeQuestions>,
  ) {
    return evaluateSystemOne({
      state,
      questions,
      config,
      fetchImpl: options.fetchImpl,
      sleep: options.sleep,
      onUsage: (info) => {
        console.log(
          `[triage] [jev] ${label} model=${info.model} input_tokens=${info.usage.input_tokens} output_tokens=${info.usage.output_tokens}`,
        );
        options.onUsage?.(info);
      },
    });
  }

  return {
    name: "jev",
    model: config.model,
    async answerEligibility(input: EligibilityInput) {
      const response = await call(
        "eligibility",
        input.state,
        toTypeSafeQuestions(buildEligibilityQuestions(input)),
      );

      return assembleEligibility(jevAnswerSource(response.answers), input);
    },
    async answerFit(input: FitInput) {
      const response = await call(
        "fit",
        { job: input.state, candidate: input.candidate },
        toTypeSafeQuestions(buildFitQuestions(input)),
      );

      return assembleFit(jevAnswerSource(response.answers), input);
    },
  };
}
