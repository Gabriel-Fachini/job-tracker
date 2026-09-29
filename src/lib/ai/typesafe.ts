/**
 * TypeSafe (Jev) client: `POST /v1/systemone`, plain `fetch`, no SDK.
 * Docs: https://docs.typesafe.ai/api.md (limits: /models.md, cautions:
 * /model-jaggedness/jev-1.13.md). Jev evaluates one `state` against a map of
 * typed questions (noul = yes/no probability, choice = one option + distribution,
 * score = probability-weighted level) and bills input tokens only, so every
 * question of a stage goes in a single call.
 */

export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_TYPESAFE_MODEL = "jev-1.13.0";
export const DEFAULT_TYPESAFE_TIMEOUT_MS = 30_000;
export const DEFAULT_TYPESAFE_MAX_RETRIES = 3;

export type NoulQuestion = {
  type: "noul";
  instructions: string | Record<string, unknown> | unknown[];
  criteria?: { true?: string; false?: string };
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: string | Record<string, unknown> | unknown[];
  /** option -> rubric text (null when the option needs no detail). Max 255 options. */
  criteria: Record<string, string | null>;
};

export type ScoreQuestion = {
  type: "score";
  instructions: string | Record<string, unknown> | unknown[];
  /** Ordered level descriptions (2 to 10). */
  criteria: string[];
};

export type TypeSafeQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};
export type TypeSafeAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type TypeSafeUsage = { input_tokens: number; output_tokens: number };

export type TypeSafeResponse = {
  model: string;
  answers: Record<string, TypeSafeAnswer>;
  usage: TypeSafeUsage;
};

export type TypeSafeConfig = {
  apiKey: string;
  model: string;
  endpoint: string;
  timeoutMs: number;
};

export class TypeSafeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypeSafeConfigurationError";
  }
}

export class TypeSafeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "TypeSafeRequestError";
  }
}

/** Reads `TYPESAFE_API_KEY` (required), `TYPESAFE_MODEL` (default: pinned version) and `TYPESAFE_TIMEOUT_MS`. */
export function getTypeSafeConfig(
  env: Record<string, string | undefined> = process.env,
): TypeSafeConfig {
  const apiKey = env.TYPESAFE_API_KEY?.trim();

  if (!apiKey) {
    throw new TypeSafeConfigurationError(
      "TRIAGE_ENGINE=jev exige TYPESAFE_API_KEY. Defina a chave ou use TRIAGE_ENGINE=openai (padrão).",
    );
  }

  const timeout = Number(env.TYPESAFE_TIMEOUT_MS);

  return {
    apiKey,
    model: env.TYPESAFE_MODEL?.trim() || DEFAULT_TYPESAFE_MODEL,
    endpoint: TYPESAFE_ENDPOINT,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TYPESAFE_TIMEOUT_MS,
  };
}

export type EvaluateOptions = {
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, TypeSafeQuestion>;
  config?: TypeSafeConfig;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Injectable for tests: waits `ms` before a retry. */
  sleep?: (ms: number) => Promise<void>;
  /** Called once per successful request with the resolved model and token usage. */
  onUsage?: (info: { model: string; usage: TypeSafeUsage; attempts: number }) => void;
  signal?: AbortSignal;
};

const RETRYABLE_STATUSES = new Set([429, 529]);

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** `retry-after` in seconds (or an HTTP date), capped so a bad header cannot stall a run. */
export function parseRetryAfterMs(value: string | null, now: number = Date.now()): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 30_000);
  }

  const date = Date.parse(value);

  return Number.isNaN(date) ? null : Math.min(Math.max(date - now, 0), 30_000);
}

export async function evaluateSystemOne(options: EvaluateOptions): Promise<TypeSafeResponse> {
  const config = options.config ?? getTypeSafeConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxRetries = options.maxRetries ?? DEFAULT_TYPESAFE_MAX_RETRIES;
  const body = JSON.stringify({
    state: options.state,
    model: config.model,
    questions: options.questions,
  });

  for (let attempt = 0; ; attempt += 1) {
    const timeout = AbortSignal.timeout(config.timeoutMs);
    let response: Response;

    try {
      response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body,
        signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      });
    } catch (error) {
      if (timeout.aborted) {
        throw new TypeSafeRequestError(`A TypeSafe não respondeu em ${config.timeoutMs} ms.`);
      }

      throw new TypeSafeRequestError(
        `Falha de rede ao chamar a TypeSafe: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
      const wait =
        parseRetryAfterMs(response.headers.get("retry-after")) ??
        Math.min(1000 * 2 ** attempt, 8_000);

      await response.body?.cancel();
      await sleep(wait);
      continue;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");

      throw new TypeSafeRequestError(
        `TypeSafe respondeu HTTP ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}`,
        response.status,
      );
    }

    const data = (await response.json()) as Partial<TypeSafeResponse>;

    if (!data || typeof data !== "object" || !data.answers || typeof data.answers !== "object") {
      throw new TypeSafeRequestError("Resposta da TypeSafe sem `answers`.", response.status);
    }

    const result: TypeSafeResponse = {
      model: typeof data.model === "string" ? data.model : config.model,
      answers: data.answers as Record<string, TypeSafeAnswer>,
      usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
    };

    options.onUsage?.({ model: result.model, usage: result.usage, attempts: attempt + 1 });

    return result;
  }
}
