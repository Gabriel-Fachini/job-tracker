import OpenAI from "openai";

import {
  OpenAiComparisonConfigurationError,
  OpenAiComparisonError,
} from "@/lib/ai/openai";

/**
 * OpenAI calls for the triage (structured, strict `json_schema`) and for
 * generation (text or JSON). Shares the SDK and `OPENAI_API_KEY` with
 * `openai.ts`; models come from `OPENAI_TRIAGE_MODEL` (default `gpt-6-luna`, no
 * reasoning) and `OPENAI_GENERATION_MODEL` (default `gpt-6-sol`, low reasoning).
 * Every id is overridable through the environment. Tier-1 limits are 500 RPM
 * and 500k TPM, so the radar keeps its `pLimit(5)` concurrency.
 */

/** Reasoning effort sent with each kind of call (`reasoning: { effort }` on the Responses API). */
export const TRIAGE_REASONING_EFFORT = "none";
export const GENERATION_REASONING_EFFORT = "low";

export const DEFAULT_OPENAI_TRIAGE_MODEL = "gpt-6-luna";
export const DEFAULT_OPENAI_GENERATION_MODEL = "gpt-6-sol";

/** The slice of the SDK the runtime uses, so tests inject a fake and never touch the network. */
export type OpenAiResponsesClient = {
  responses: {
    create: (params: Record<string, unknown>) => Promise<{
      output_text?: string | null;
      incomplete_details?: { reason?: string } | null;
      usage?: { input_tokens?: number; output_tokens?: number } | null;
      model?: string;
    }>;
  };
};

export function requireOpenAiApiKey(env: Record<string, string | undefined> = process.env): string {
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new OpenAiComparisonConfigurationError(
      "Falta OPENAI_API_KEY: defina a chave para usar o motor OpenAI, ou troque o motor (TRIAGE_ENGINE / GENERATION_ENGINE) para ollama.",
    );
  }

  return apiKey;
}

export function getOpenAiTriageModel(env: Record<string, string | undefined> = process.env): string {
  return env.OPENAI_TRIAGE_MODEL?.trim() || DEFAULT_OPENAI_TRIAGE_MODEL;
}

export function getOpenAiGenerationModel(env: Record<string, string | undefined> = process.env): string {
  return env.OPENAI_GENERATION_MODEL?.trim() || DEFAULT_OPENAI_GENERATION_MODEL;
}

let cachedClient: { apiKey: string; client: OpenAiResponsesClient } | null = null;

/** One SDK client per API key (a radar run makes hundreds of calls). */
export function createOpenAiResponsesClient(apiKey: string = requireOpenAiApiKey()): OpenAiResponsesClient {
  if (cachedClient?.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new OpenAI({ apiKey }) as unknown as OpenAiResponsesClient };
  }

  return cachedClient.client;
}

export type OpenAiCallResult = {
  model: string;
  outputText: string;
  usage: { inputTokens: number; outputTokens: number };
};

type CommonCallOptions = {
  /** `none|low|medium|high|xhigh|max`; omit to use the model's default. */
  reasoningEffort?: string;
  model: string;
  system: string;
  user: string;
  maxOutputTokens?: number;
  client?: OpenAiResponsesClient;
  /** Logged with the model and token usage. */
  label?: string;
  timeoutMs?: number;
};

async function callResponses(
  options: CommonCallOptions,
  text: Record<string, unknown> | undefined,
): Promise<OpenAiCallResult> {
  const client = options.client ?? createOpenAiResponsesClient();
  let response: Awaited<ReturnType<OpenAiResponsesClient["responses"]["create"]>>;

  try {
    response = await client.responses.create({
      model: options.model,
      max_output_tokens: options.maxOutputTokens ?? 4000,
      ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
      input: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      ...(text ? { text } : {}),
    });
  } catch (error) {
    throw new OpenAiComparisonError(
      `Falha na chamada à OpenAI (${options.model}): ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
  }

  if (response.incomplete_details) {
    throw new OpenAiComparisonError(
      `A OpenAI interrompeu a resposta (${options.model}): ${response.incomplete_details.reason ?? "motivo desconhecido"}.`,
    );
  }

  const outputText = response.output_text?.trim();

  if (!outputText) {
    throw new OpenAiComparisonError(`A OpenAI (${options.model}) não devolveu texto.`);
  }

  const usage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };

  console.log(
    `[openai] ${options.label ?? "call"} model=${response.model ?? options.model} input_tokens=${usage.inputTokens} output_tokens=${usage.outputTokens}`,
  );

  return { model: response.model ?? options.model, outputText, usage };
}

/** Strict structured output: the answer always parses against `schema`. */
export async function callOpenAiStructured(
  options: CommonCallOptions & { schemaName: string; schema: Record<string, unknown> },
): Promise<OpenAiCallResult> {
  return callResponses(
    { reasoningEffort: TRIAGE_REASONING_EFFORT, ...options },
    {
      format: {
        type: "json_schema",
        name: options.schemaName,
        schema: options.schema,
        strict: true,
      },
    },
  );
}

/** Free text (or JSON when `json` is set: the prompt must ask for JSON). */
export async function callOpenAiText(
  options: CommonCallOptions & { json?: boolean },
): Promise<OpenAiCallResult> {
  return callResponses(
    { reasoningEffort: GENERATION_REASONING_EFFORT, ...options },
    options.json ? { format: { type: "json_object" } } : undefined,
  );
}
