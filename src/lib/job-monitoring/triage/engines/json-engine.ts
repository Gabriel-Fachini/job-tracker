import { callOllamaLlm, getOllamaConfig, unloadOllamaModelIfLocal } from "@/lib/ai/ollama";
import {
  callOpenAiStructured,
  getOpenAiTriageModel,
  requireOpenAiApiKey,
  type OpenAiResponsesClient,
} from "@/lib/ai/openai-runtime";

import {
  buildEligibilityQuestions,
  buildFitQuestions,
  buildJsonSchema,
  confidenceFromLabel,
  JSON_ENGINE_SYSTEM_PROMPT,
  renderJsonEngineUserMessage,
  type QuestionDef,
} from "../questions";
import type { EligibilityInput, FitInput, TriageEngine, TriageEngineName } from "../types";
import { assembleEligibility, assembleFit, type AnswerSource } from "./assemble";

/** Reads answers from the JSON a strict-schema model returns (`{ id: { value|answer|level, confidence } }`). */
export function jsonAnswerSource(raw: unknown): AnswerSource {
  const answers = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const entry = (id: string) => {
    const value = answers[id];

    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  };

  return {
    choice(id, allowed, fallback) {
      const answer = entry(id);
      const value = answer?.value;

      if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
        return { value: fallback, confidence: 0 };
      }

      return { value: value as (typeof allowed)[number], confidence: confidenceFromLabel(answer?.confidence) };
    },
    noul(id) {
      const answer = entry(id);
      const confidence = confidenceFromLabel(answer?.confidence);

      if (answer?.answer === "yes") return confidence;
      if (answer?.answer === "no") return 1 - confidence;

      return 0.5;
    },
    level(id, levels) {
      const answer = entry(id);
      const level = Number(answer?.level);

      if (!Number.isInteger(level) || level < 1 || level > levels) {
        return null;
      }

      return { value: level, confidence: confidenceFromLabel(answer?.confidence) };
    },
  };
}

/** Parses a model's JSON text (tolerates code fences and surrounding text). */
export function parseEngineJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const candidate = fenced ?? (start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed);

  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("O modelo devolveu JSON inválido para a triagem.");
  }
}

type Transport = (call: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  label: string;
}) => Promise<{ text: string; model: string }>;

function createJsonEngine(name: TriageEngineName, model: string, transport: Transport): TriageEngine {
  async function ask(
    label: string,
    state: Record<string, unknown>,
    defs: QuestionDef[],
    extra: Record<string, unknown> = {},
  ) {
    const result = await transport({
      system: JSON_ENGINE_SYSTEM_PROMPT,
      user: renderJsonEngineUserMessage(state, defs, extra),
      schema: buildJsonSchema(defs),
      schemaName: `triage_${label}`,
      label,
    });

    return jsonAnswerSource(parseEngineJson(result.text));
  }

  return {
    name,
    model,
    async answerEligibility(input: EligibilityInput) {
      const defs = buildEligibilityQuestions(input);

      return assembleEligibility(await ask("eligibility", input.state, defs), input);
    },
    async answerFit(input: FitInput) {
      const defs = buildFitQuestions(input);

      return assembleFit(await ask("fit", input.state, defs, { candidate: input.candidate }), input);
    },
  };
}

/** OpenAI (default engine): strict `json_schema`, model `OPENAI_TRIAGE_MODEL`. Fails closed without `OPENAI_API_KEY`. */
export function createOpenAiEngine(
  options: { client?: OpenAiResponsesClient; model?: string; env?: Record<string, string | undefined> } = {},
): TriageEngine {
  if (!options.client) {
    requireOpenAiApiKey(options.env);
  }

  const model = options.model ?? getOpenAiTriageModel(options.env);

  return createJsonEngine("openai", model, async ({ system, user, schema, schemaName, label }) => {
    const result = await callOpenAiStructured({
      model,
      system,
      user,
      schema,
      schemaName,
      client: options.client,
      maxOutputTokens: 2000,
      label: `triage-${label}`,
    });

    return { text: result.outputText, model: result.model };
  });
}

/** Ollama: the same contract and schema, as a `format` JSON schema on `/api/generate`. */
export function createOllamaEngine(options: { call?: typeof callOllamaLlm; model?: string } = {}): TriageEngine {
  const config = options.call ? null : getOllamaConfig();
  const model = options.model ?? config?.model ?? "ollama";
  const call = options.call ?? callOllamaLlm;

  return createJsonEngine("ollama", model, async ({ system, user, schema }) => {
    try {
      const text = await call(user, {
        system,
        format: schema,
        think: false,
        generationOptions: { temperature: 0 },
      });

      return { text, model };
    } finally {
      if (config?.runtimeMode === "local") {
        try {
          await unloadOllamaModelIfLocal();
        } catch {
          // No functional impact on the run.
        }
      }
    }
  });
}
