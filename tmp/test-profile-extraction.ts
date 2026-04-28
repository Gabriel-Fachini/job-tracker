import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { loadEnvConfig } from "@next/env";
import { PDFParse } from "pdf-parse";

import {
  callLocalLlm,
  getOllamaConfig,
  parseExtractedProfileResponse,
  PROFILE_EXTRACTION_JSON_SCHEMA,
  PROFILE_EXTRACTION_SYSTEM_PROMPT,
  type ExtractedProfile,
} from "@/lib/ai/ollama";
import {
  callOpenAiForComparisonDetailed,
  getOpenAiComparisonConfig,
  OpenAiComparisonConfigurationError,
  OpenAiComparisonError,
  type ProfileExtractionComparison,
} from "@/lib/ai/openai";

const cwd = process.cwd();
const defaultResumeDir = path.join(cwd, "uploads", "resumes", "master");
const outputPath = path.join(cwd, "tmp", "profile-extraction-result.json");
const rawLocalOutputPath = path.join(cwd, "tmp", "profile-extraction-local-raw.txt");
const testTimeoutMs = 360_000;
const heartbeatMs = 5_000;
const OPENAI_PRICING_PER_1M_TOKENS: Record<
  string,
  { inputUsd: number; outputUsd: number }
> = {
  "gpt-5.5": { inputUsd: 5, outputUsd: 30 },
  "gpt-5.4": { inputUsd: 2.5, outputUsd: 15 },
  "gpt-5.4-mini": { inputUsd: 0.75, outputUsd: 4.5 },
  "gpt-5": { inputUsd: 1.25, outputUsd: 10 },
  "gpt-5.1": { inputUsd: 1.25, outputUsd: 10 },
  "gpt-5.2": { inputUsd: 1.75, outputUsd: 14 },
  "gpt-5-mini": { inputUsd: 0.25, outputUsd: 2 },
  "gpt-5-nano": { inputUsd: 0.05, outputUsd: 0.4 },
  "gpt-4.1": { inputUsd: 2, outputUsd: 8 },
  "gpt-4.1-mini": { inputUsd: 0.4, outputUsd: 1.6 },
  "gpt-4o": { inputUsd: 2.5, outputUsd: 10 },
  "gpt-4o-mini": { inputUsd: 0.15, outputUsd: 0.6 },
};

loadEnvConfig(cwd);

let runStartedAt = 0;
const execFileAsync = promisify(execFile);

type ProviderMetrics = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
  totalDurationMs: number | null;
};

type ProfileExtractionComparisonWithMetrics = ProfileExtractionComparison & {
  metrics: {
    local: ProviderMetrics;
    openai: ProviderMetrics;
  };
  validation: {
    local: string | null;
    openai: string | null;
  };
};

type RunMode = "local-only" | "compare" | "openai-only";

type StoredRun = {
  runId: string;
  createdAt: string;
  sourcePdfPath: string;
  compareEnabled: boolean;
  runMode: RunMode;
  compareGroupId: string | null;
  provider: "local" | "openai";
  providerStatus: "success" | "skipped" | "error";
  model: string | null;
  output: ExtractedProfile | Record<string, unknown> | null;
  rawOutput: string | null;
  error: string | null;
  observations: string[];
  input: string;
  metrics: ProviderMetrics;
  validationError: string | null;
};

type StoredRunHistory = {
  version: 1;
  runs: StoredRun[];
};

async function main() {
  const { pdfPath, compare, openAiOnly } = await resolveInput(
    process.argv.slice(2),
  );
  runStartedAt = Date.now();

  logStep(`Using PDF: ${pdfPath}`);
  logStep("Reading PDF from disk");
  const buffer = await readFile(pdfPath);
  logStep(`PDF loaded (${buffer.byteLength} bytes)`);

  logStep("Extracting text from PDF");
  const parser = new PDFParse({ data: buffer });
  const parsedPdf = await parser.getText();
  const rawText = parsedPdf.text.trim();
  logStep(`PDF text extracted (${rawText.length} chars)`);

  if (!rawText) {
    throw new Error(`No text could be extracted from ${pdfPath}.`);
  }

  const runMode: RunMode = openAiOnly
    ? "openai-only"
    : compare
      ? "compare"
      : "local-only";
  try {
    const localResult = openAiOnly
      ? null
      : await runLocalProfileExtraction(rawText, {
          stream: false,
          think: false,
        });

    let result: ProfileExtractionComparisonWithMetrics;

    if (openAiOnly) {
      const openAiModel = process.env.OPENAI_COMPARISON_MODEL ?? "gpt-5.4";

      try {
        const openAiResult = await streamOpenAiProfileExtraction(rawText);

        result = {
          input: rawText,
          local: {
            status: "skipped",
            model: null,
            output: null,
          },
          openai: {
            status: openAiResult.status,
            model: openAiResult.model,
            output: openAiResult.output,
            rawOutput: openAiResult.rawOutput,
            error: openAiResult.error,
          },
          observations: [
            "This run executed only the OpenAI extraction path.",
            "No local baseline was produced for side-by-side comparison in this run.",
          ],
      metrics: {
        local: emptyMetrics(),
        openai: openAiResult.metrics,
      },
      validation: {
        local: null,
        openai: openAiResult.validationError,
      },
    };
  } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const skipped = error instanceof OpenAiComparisonConfigurationError;

        result = {
          input: rawText,
          local: {
            status: "skipped",
            model: null,
            output: null,
          },
          openai: {
            status: skipped ? "skipped" : "error",
            model: skipped ? null : openAiModel,
            output: null,
            rawOutput: null,
            error: message,
          },
          observations: [
            "This run executed only the OpenAI extraction path.",
            message,
          ],
        metrics: {
          local: emptyMetrics(),
          openai: emptyMetrics(),
        },
        validation: {
          local: null,
          openai: message,
        },
      };
    }
  } else if (!compare) {
      result = {
        input: rawText,
        local: {
          status: "success",
          model: localResult!.model,
          output: localResult!.output,
        },
        openai: {
          status: "skipped",
          model: null,
          output: null,
          rawOutput: null,
          error: "Comparison disabled for this run.",
        },
        observations: [
          "Temporary script executed only the local extraction flow.",
        ],
      metrics: {
        local: localResult!.metrics,
        openai: emptyMetrics(),
      },
      validation: {
        local: localResult!.validationError,
        openai: null,
      },
    };
  } else {
      const openAiModel = process.env.OPENAI_COMPARISON_MODEL ?? "gpt-5";

      try {
        const openAiResult = await streamOpenAiProfileExtraction(rawText);

        result = {
          input: rawText,
          local: {
            status: "success",
            model: localResult!.model,
            output: localResult!.output,
          },
          openai: {
            status: openAiResult.status,
            model: openAiResult.model,
            output: openAiResult.output,
            rawOutput: openAiResult.rawOutput,
            error: openAiResult.error,
          },
          observations:
            openAiResult.status === "success" && openAiResult.output
              ? buildComparisonObservations(localResult!.output, openAiResult.output)
              : buildOpenAiFallbackObservations(
                  openAiResult.error ??
                    "OpenAI comparison did not return output.",
                  openAiResult.status === "skipped",
                ),
        metrics: {
          local: localResult!.metrics,
          openai: openAiResult.metrics,
        },
        validation: {
          local: localResult!.validationError,
          openai: openAiResult.validationError,
        },
      };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const skipped = error instanceof OpenAiComparisonConfigurationError;

        result = {
          input: rawText,
          local: {
            status: "success",
            model: localResult!.model,
            output: localResult!.output,
          },
          openai: {
            status: skipped ? "skipped" : "error",
            model: skipped ? null : openAiModel,
            output: null,
            rawOutput: null,
            error: message,
          },
          observations: buildOpenAiFallbackObservations(message, skipped),
        metrics: {
          local: localResult!.metrics,
          openai: emptyMetrics(),
        },
        validation: {
          local: localResult!.validationError,
          openai: message,
        },
      };
    }
  }

    const storedRuns = buildStoredRuns({
      result,
      pdfPath,
      compare,
      runMode,
    });

    logStep("Appending run to comparison result JSON");
    await mkdir(path.dirname(outputPath), { recursive: true });
    const history = await loadExistingHistory();
    history.runs.push(...storedRuns);
    await writeFile(outputPath, JSON.stringify(history, null, 2));

    logStep(`Done in ${formatElapsed(Date.now() - runStartedAt)}`);
    console.log(`PDF: ${pdfPath}`);
    console.log(`Chars extracted: ${rawText.length}`);
    console.log(`Compare mode: ${compare ? "enabled" : "disabled"}`);
    console.log(`Run mode: ${runMode}`);
    console.log(`Timeout ms: ${testTimeoutMs}`);
    console.log(
      `OLLAMA_CPP_MODEL: ${process.env.OLLAMA_CPP_MODEL ?? "undefined"}`,
    );
    console.log(
      `OLLAMA_CPP_BASE_URL: ${process.env.OLLAMA_CPP_BASE_URL ?? process.env.OLLAMA_BASE_URL ?? "undefined"}`,
    );
    for (const storedRun of storedRuns) {
      console.log(
        `${storedRun.provider} tokens: input=${formatMetricValue(storedRun.metrics.inputTokens)} output=${formatMetricValue(storedRun.metrics.outputTokens)} reasoning=${formatMetricValue(storedRun.metrics.reasoningTokens)} cost=${formatUsd(storedRun.metrics.costUsd)}`,
      );
      console.log(
        `${storedRun.provider} validation: ${storedRun.validationError ?? "passed or skipped"}`,
      );
    }
  console.log(`Runs stored: ${history.runs.length}`);
  console.log(`Result saved to: ${outputPath}`);
  } finally {
    await unloadLocalModelIfNeeded(runMode);
  }
}

async function resolveInput(args: string[]) {
  const compare = args.includes("--compare");
  const openAiOnly = args.includes("--openai-only");
  const explicitPath = args.find((arg) => !arg.startsWith("--"));

  if (explicitPath) {
    return {
      pdfPath: path.resolve(cwd, explicitPath),
      compare: openAiOnly ? false : compare,
      openAiOnly,
    };
  }

  const files = await readdir(defaultResumeDir);
  const firstPdf = files.find((file) => file.toLowerCase().endsWith(".pdf"));

  if (!firstPdf) {
    throw new Error(
      `No PDF file was found in the default directory: ${defaultResumeDir}`,
    );
  }

  return {
    pdfPath: path.join(defaultResumeDir, firstPdf),
    compare: openAiOnly ? false : compare,
    openAiOnly,
  };
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Profile extraction test failed: ${message}`);
  process.exitCode = 1;
});

function logStep(message: string) {
  const timestamp = new Date().toISOString();
  const elapsed =
    runStartedAt > 0 ? ` +${formatElapsed(Date.now() - runStartedAt)}` : "";
  console.log(`[profile-test ${timestamp}${elapsed}] ${message}`);
}

function buildComparisonObservations(
  localOutput: ExtractedProfile,
  openAiOutput: ExtractedProfile,
) {
  const observations = [
    "OpenAI comparison completed without blocking the local extraction flow.",
  ];

  if (localOutput.profile.fullName !== openAiOutput.profile.fullName) {
    observations.push(
      `Different fullName values detected: local="${localOutput.profile.fullName}" vs openai="${openAiOutput.profile.fullName}".`,
    );
  }

  observations.push(
    `Experiences: local=${localOutput.experiences.length}, openai=${openAiOutput.experiences.length}.`,
  );
  observations.push(
    `Skills: local=${localOutput.skills.length}, openai=${openAiOutput.skills.length}.`,
  );
  observations.push(
    `Projects: local=${localOutput.projects.length}, openai=${openAiOutput.projects.length}.`,
  );
  observations.push(
    `Education entries: local=${localOutput.education.length}, openai=${openAiOutput.education.length}.`,
  );

  return observations;
}

function buildStoredRuns(input: {
  result: ProfileExtractionComparisonWithMetrics;
  pdfPath: string;
  compare: boolean;
  runMode: RunMode;
}): StoredRun[] {
  const createdAt = new Date().toISOString();
  const compareGroupId = input.runMode === "compare" ? createRunId() : null;
  const common = {
    createdAt,
    sourcePdfPath: input.pdfPath,
    compareEnabled: input.compare,
    runMode: input.runMode,
    compareGroupId,
    input: input.result.input,
  };

  const runs: StoredRun[] = [];

  if (input.runMode !== "openai-only") {
    runs.push({
      ...common,
      runId: createRunId(),
      provider: "local",
      providerStatus: input.result.local.status,
      model: input.result.local.model,
      output: input.result.local.output,
      rawOutput: null,
      error: null,
      observations: input.result.observations,
      metrics: input.result.metrics.local,
      validationError: input.result.validation.local,
    });
  }

  if (input.runMode !== "local-only") {
    runs.push({
      ...common,
      runId: createRunId(),
      provider: "openai",
      providerStatus: input.result.openai.status,
      model: input.result.openai.model,
      output: input.result.openai.output,
      rawOutput: input.result.openai.rawOutput,
      error: input.result.openai.error ?? null,
      observations: input.result.observations,
      metrics: input.result.metrics.openai,
      validationError: input.result.validation.openai,
    });
  }

  return runs;
}

async function runLocalProfileExtraction(
  rawText: string,
  options: { stream: boolean; think: boolean },
) {
  if (options.stream) {
    return streamLocalProfileExtraction(rawText, options);
  }

  return nonStreamingLocalProfileExtraction(rawText);
}

async function nonStreamingLocalProfileExtraction(rawText: string) {
  const { model } = getOllamaConfig();
  const ticker = createProgressTicker("Local extraction");

  logStep(
    `Starting local extraction with model ${model} (timeout ${testTimeoutMs}ms, heartbeat ${heartbeatMs}ms)`,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), testTimeoutMs);

  try {
    const rawOutput = await callLocalLlm(rawText, {
      system: PROFILE_EXTRACTION_SYSTEM_PROMPT,
      format: PROFILE_EXTRACTION_JSON_SCHEMA,
      timeoutMs: testTimeoutMs,
      think: false,
      generationOptions: {
        temperature: 0,
      },
    });

    await writeFile(rawLocalOutputPath, rawOutput);

    const inspected = inspectModelOutput(rawOutput);
    const output = inspected.output;

    ticker.stop("completed");

    const metrics: ProviderMetrics = {
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      costUsd: 0,
      totalDurationMs: null,
    };

    logStep(
      `Local usage summary: input_tokens=${formatMetricValue(metrics.inputTokens)} output_tokens=${formatMetricValue(metrics.outputTokens)} cost=${formatUsd(metrics.costUsd)}`,
    );

    if (inspected.validationError) {
      logStep(
        `Local schema validation warning: ${inspected.validationError} Raw local output saved to ${rawLocalOutputPath}`,
      );
    }

    return {
      model,
      output,
      rawOutput,
      thinking: "",
      metrics,
      validationError: inspected.validationError,
    };
  } catch (error) {
    ticker.stop("failed");

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Local model request timed out after ${formatElapsed(testTimeoutMs)}.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function streamLocalProfileExtraction(
  rawText: string,
  options: { stream: boolean; think: boolean },
) {
  const { baseUrl, model } = getOllamaConfig();
  const ticker = createProgressTicker("Local extraction");

  logStep(
    `Starting local extraction with model ${model} (timeout ${testTimeoutMs}ms, heartbeat ${heartbeatMs}ms)`,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), testTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: rawText,
        system: PROFILE_EXTRACTION_SYSTEM_PROMPT,
        format: "json",
        stream: true,
        think: options.think,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Local model request failed with status ${response.status} for model "${model}". ${errorBody}`.trim(),
      );
    }

    if (!response.body) {
      throw new Error("Local model response body was empty.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let thinking = "";
    let outputText = "";
    let finalChunkMetrics: {
      totalDurationNs?: number;
      promptEvalCount?: number;
      evalCount?: number;
    } | null = null;
    let printedThinkingHeader = false;
    let printedResponseHeader = false;

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        const chunk = JSON.parse(trimmed) as {
          response?: string;
          thinking?: string;
          error?: string;
          done?: boolean;
          total_duration?: number;
          prompt_eval_count?: number;
          eval_count?: number;
        };

        if (chunk.error) {
          throw new Error(`Local model streaming error: ${chunk.error}`);
        }

        if (chunk.thinking) {
          if (!printedThinkingHeader) {
            printedThinkingHeader = true;
            process.stdout.write("\n[ollama thinking]\n");
          }

          thinking += chunk.thinking;
          process.stdout.write(chunk.thinking);
        }

        if (chunk.response) {
          if (!printedResponseHeader) {
            printedResponseHeader = true;
            process.stdout.write(
              printedThinkingHeader ? "\n\n[ollama response]\n" : "\n[ollama response]\n",
            );
          }

          outputText += chunk.response;
          process.stdout.write(chunk.response);
        }

        if (chunk.done) {
          process.stdout.write("\n");
          finalChunkMetrics = {
            totalDurationNs: chunk.total_duration,
            promptEvalCount: chunk.prompt_eval_count,
            evalCount: chunk.eval_count,
          };
          if (typeof chunk.total_duration === "number") {
            logStep(
              `Local model reported total_duration=${formatNanoseconds(chunk.total_duration)} input_tokens=${chunk.prompt_eval_count ?? "unknown"} output_tokens=${chunk.eval_count ?? "unknown"} cost=${formatUsd(0)}`,
            );
          }
        }
      }
    }

    if (pending.trim()) {
      const chunk = JSON.parse(pending.trim()) as {
        response?: string;
        thinking?: string;
        error?: string;
      };

      if (chunk.error) {
        throw new Error(`Local model streaming error: ${chunk.error}`);
      }

      if (chunk.thinking) {
        thinking += chunk.thinking;
      }

      if (chunk.response) {
        outputText += chunk.response;
      }
    }

    await writeFile(rawLocalOutputPath, outputText);

    let output: ExtractedProfile;
    try {
      output = parseExtractedProfileResponse(outputText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message} Raw local output saved to ${rawLocalOutputPath}`,
      );
    }
    ticker.stop("completed");

    const metrics: ProviderMetrics = {
      inputTokens: finalChunkMetrics?.promptEvalCount ?? null,
      outputTokens: finalChunkMetrics?.evalCount ?? null,
      reasoningTokens: null,
      costUsd: 0,
      totalDurationMs:
        typeof finalChunkMetrics?.totalDurationNs === "number"
          ? Math.round(finalChunkMetrics.totalDurationNs / 1_000_000)
          : null,
    };

    logStep(
      `Local usage summary: input_tokens=${formatMetricValue(metrics.inputTokens)} output_tokens=${formatMetricValue(metrics.outputTokens)} cost=${formatUsd(metrics.costUsd)}`,
    );

    return {
      model,
      output,
      rawOutput: outputText,
      thinking,
      metrics,
    };
  } catch (error) {
    ticker.stop("failed");

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Local model request timed out after ${formatElapsed(testTimeoutMs)}.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function streamOpenAiProfileExtraction(rawText: string) {
  const { model } = getOpenAiComparisonConfig();
  const ticker = createProgressTicker("OpenAI comparison");

  logStep(
    `Starting OpenAI comparison with model ${model} (heartbeat ${heartbeatMs}ms)`,
  );

  let outputText = "";

  try {
    const detailedResponse = await callOpenAiForComparisonDetailed(
      PROFILE_EXTRACTION_SYSTEM_PROMPT,
      rawText,
    );
    outputText = detailedResponse.outputText;

    if (!outputText.trim()) {
      throw new OpenAiComparisonError(
        "OpenAI comparison response did not include output_text.",
      );
    }

    const inspected = inspectModelOutput(outputText);
    const output = inspected.output;
    ticker.stop("completed");
    const usage = detailedResponse.response.usage;
    const metrics: ProviderMetrics = {
      inputTokens:
        typeof usage?.input_tokens === "number" ? usage.input_tokens : null,
      outputTokens:
        typeof usage?.output_tokens === "number" ? usage.output_tokens : null,
      reasoningTokens:
        typeof usage?.output_tokens_details?.reasoning_tokens === "number"
          ? usage.output_tokens_details.reasoning_tokens
          : null,
      costUsd: estimateOpenAiCostUsd(
        detailedResponse.model,
        typeof usage?.input_tokens === "number" ? usage.input_tokens : null,
        typeof usage?.output_tokens === "number" ? usage.output_tokens : null,
      ),
      totalDurationMs: null,
    };

    logStep(
      `OpenAI usage summary: input_tokens=${formatMetricValue(metrics.inputTokens)} output_tokens=${formatMetricValue(metrics.outputTokens)} reasoning_tokens=${formatMetricValue(metrics.reasoningTokens)} cost=${formatUsd(metrics.costUsd)}`,
    );

    if (inspected.validationError) {
      logStep(`OpenAI schema validation warning: ${inspected.validationError}`);
    }

    return {
      status: "success" as const,
      model,
      output,
      rawOutput: outputText,
      reasoningText: "",
      reasoningSummary: "",
      error: null,
      metrics,
      validationError: inspected.validationError,
    };
  } catch (error) {
    ticker.stop("failed");
    throw error;
  }
}

function buildOpenAiFallbackObservations(message: string, skipped: boolean) {
  if (skipped) {
    return [
      "OpenAI comparison was skipped because the optional remote configuration is missing.",
      message,
      "The primary local extraction remains usable without the comparison path.",
    ];
  }

  return [
    "OpenAI comparison failed, but the local extraction path still succeeded.",
    message,
    "The comparison path remains optional and non-blocking by design.",
  ];
}

function createProgressTicker(label: string) {
  const startedAt = Date.now();
  const timer = setInterval(() => {
    logStep(`${label} in progress (${formatElapsed(Date.now() - startedAt)})`);
  }, heartbeatMs);

  return {
    stop(status: "completed" | "failed") {
      clearInterval(timer);
      logStep(
        `${label} ${status} after ${formatElapsed(Date.now() - startedAt)}`,
      );
    },
  };
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

function formatNanoseconds(value: number) {
  return formatElapsed(Math.round(value / 1_000_000));
}

function emptyMetrics(): ProviderMetrics {
  return {
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    costUsd: null,
    totalDurationMs: null,
  };
}

async function loadExistingHistory(): Promise<StoredRunHistory> {
  try {
    const existingText = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(existingText) as unknown;

    if (isStoredRunHistory(parsed)) {
      return parsed;
    }

    if (isLegacyStoredRun(parsed)) {
      return {
        version: 1,
        runs: [
          {
            ...parsed,
            runId: "legacy-run-1",
            createdAt: new Date().toISOString(),
            sourcePdfPath: "unknown",
            compareEnabled: parsed.openai?.status !== "skipped",
            runMode:
              parsed.local?.status === "success" &&
              parsed.openai?.status === "success"
                ? "compare"
                : parsed.openai?.status === "success"
                  ? "openai-only"
                  : "local-only",
          },
        ],
      };
    }

    return {
      version: 1,
      runs: [],
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    if (code === "ENOENT") {
      return {
        version: 1,
        runs: [],
      };
    }

    throw error;
  }
}

function isStoredRunHistory(value: unknown): value is StoredRunHistory {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "runs" in value &&
    Array.isArray((value as { runs: unknown }).runs)
  );
}

function isLegacyStoredRun(
  value: unknown,
): value is ProfileExtractionComparisonWithMetrics {
  return (
    typeof value === "object" &&
    value !== null &&
    "input" in value &&
    "local" in value &&
    "openai" in value &&
    "metrics" in value
  );
}

function createRunId() {
  return `run-${Date.now()}`;
}

function estimateOpenAiCostUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
) {
  const pricing = OPENAI_PRICING_PER_1M_TOKENS[model];

  if (!pricing || inputTokens === null || outputTokens === null) {
    return null;
  }

  return (
    (inputTokens / 1_000_000) * pricing.inputUsd +
    (outputTokens / 1_000_000) * pricing.outputUsd
  );
}

function formatUsd(value: number | null) {
  if (value === null) {
    return "unknown";
  }

  return `US$${value.toFixed(6)}`;
}

function formatMetricValue(value: number | null) {
  return value === null ? "unknown" : String(value);
}

function inspectModelOutput(rawOutput: string): {
  output: ExtractedProfile | null;
  validationError: string | null;
} {
  const parsed = parseJsonObjectOnly(rawOutput);

  if (!parsed) {
    return {
      output: null,
      validationError: "Model output was not valid JSON.",
    };
  }

  try {
    return {
      output: parseExtractedProfileResponse(rawOutput),
      validationError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: parsed as ExtractedProfile,
      validationError: message,
    };
  }
}

function parseJsonObjectOnly(rawOutput: string): Record<string, unknown> | null {
  const normalized = rawOutput.trim();
  const withoutFence = normalized
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const candidates = [
    withoutFence,
    sliceOuterJsonObject(withoutFence),
    sliceOuterJsonObject(normalized),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function sliceOuterJsonObject(value: string): string | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1);
}

async function unloadLocalModelIfNeeded(runMode: RunMode) {
  if (runMode === "openai-only") {
    return;
  }

  const model = process.env.OLLAMA_CPP_MODEL?.trim();

  if (!model) {
    return;
  }

  try {
    logStep(`Unloading local model ${model}`);
    await execFileAsync("ollama", ["stop", model]);
    logStep(`Local model ${model} unloaded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep(`Could not unload local model ${model}: ${message}`);
  }
}
