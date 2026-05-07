import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";

import {
  extractProfileFromText,
  getOllamaConfig,
  type ExtractedProfile,
  parseExtractedProfileResponse,
  PROFILE_EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/ai/ollama";

const DEFAULT_OPENAI_COMPARISON_MODEL = "gpt-5.4";

export type OpenAiComparisonResult = {
  model: string;
  response: Response;
  outputText: string;
};

export type ProfileExtractionComparison = {
  input: string;
  primary: {
    status: "success" | "skipped";
    model: string | null;
    output: ExtractedProfile | null;
  };
  openai: {
    status: "success" | "skipped" | "error";
    model: string | null;
    output: ExtractedProfile | null;
    rawOutput: string | null;
    error: string | null;
  };
  observations: string[];
};

export class OpenAiComparisonConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAiComparisonConfigurationError";
  }
}

export class OpenAiComparisonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAiComparisonError";
  }
}

export function getOpenAiComparisonConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model =
    process.env.OPENAI_COMPARISON_MODEL?.trim() ??
    DEFAULT_OPENAI_COMPARISON_MODEL;

  if (!apiKey) {
    throw new OpenAiComparisonConfigurationError(
      "Missing OPENAI_API_KEY configuration for comparison mode.",
    );
  }

  return { apiKey, model };
}

export async function callOpenAiForComparison(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const result = await callOpenAiForComparisonDetailed(systemPrompt, userMessage);
  return result.outputText;
}

export async function callOpenAiForComparisonDetailed(
  systemPrompt: string,
  userMessage: string,
): Promise<OpenAiComparisonResult> {
  const { apiKey, model } = getOpenAiComparisonConfig();
  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    if (!response.output_text.trim()) {
      throw new OpenAiComparisonError(
        "OpenAI comparison response did not include output_text.",
      );
    }

    return {
      model,
      response,
      outputText: response.output_text,
    };
  } catch (error) {
    if (error instanceof OpenAiComparisonError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new OpenAiComparisonError(
        `OpenAI comparison request failed: ${error.message}`,
      );
    }

    throw new OpenAiComparisonError(
      "OpenAI comparison request failed for an unknown reason.",
    );
  }
}

export async function extractProfileWithOpenAi(
  rawText: string,
): Promise<ExtractedProfile> {
  const cleanedText = rawText.trim();

  if (!cleanedText) {
    throw new OpenAiComparisonError(
      "Cannot compare profile extraction with an empty text input.",
    );
  }

  const response = await callOpenAiForComparison(
    PROFILE_EXTRACTION_SYSTEM_PROMPT,
    cleanedText,
  );

  return parseExtractedProfileResponse(response);
}

export async function compareProfileExtraction(
  rawText: string,
  options: { localTimeoutMs?: number } = {},
): Promise<ProfileExtractionComparison> {
  const cleanedText = rawText.trim();
  const primaryOutput = await extractProfileFromText(cleanedText, {
    timeoutMs: options.localTimeoutMs,
  });
  const primaryModel = getOllamaConfig().model;
  const openAiModel =
    process.env.OPENAI_COMPARISON_MODEL?.trim() ??
    DEFAULT_OPENAI_COMPARISON_MODEL;

  try {
    const rawOutput = await callOpenAiForComparison(
      PROFILE_EXTRACTION_SYSTEM_PROMPT,
      cleanedText,
    );
    const output = parseExtractedProfileResponse(rawOutput);

    return {
      input: cleanedText,
      primary: {
        status: "success",
        model: primaryModel,
        output: primaryOutput,
      },
      openai: {
        status: "success",
        model: openAiModel,
        output,
        rawOutput,
        error: null,
      },
      observations: buildComparisonObservations(primaryOutput, output),
    };
  } catch (error) {
    const isConfigurationError =
      error instanceof OpenAiComparisonConfigurationError;
    const message =
      error instanceof Error
        ? error.message
        : "OpenAI comparison failed for an unknown reason.";

    return {
      input: cleanedText,
      primary: {
        status: "success",
        model: primaryModel,
        output: primaryOutput,
      },
      openai: {
        status: isConfigurationError ? "skipped" : "error",
        model: isConfigurationError ? null : openAiModel,
        output: null,
        rawOutput: null,
        error: message,
      },
      observations: buildFallbackObservations(message, isConfigurationError),
    };
  }
}

function buildComparisonObservations(
  localOutput: ExtractedProfile,
  openAiOutput: ExtractedProfile,
): string[] {
  const observations = [
    "OpenAI comparison completed without blocking the primary Ollama extraction flow.",
  ];

  if (localOutput.profile.fullName !== openAiOutput.profile.fullName) {
    observations.push(
      `Different fullName values detected: primary=\"${localOutput.profile.fullName}\" vs openai=\"${openAiOutput.profile.fullName}\".`,
    );
  }

  observations.push(
    `Experiences: primary=${localOutput.experiences.length}, openai=${openAiOutput.experiences.length}.`,
  );
  observations.push(
    `Skills: primary=${localOutput.skills.length}, openai=${openAiOutput.skills.length}.`,
  );
  observations.push(
    `Projects: primary=${localOutput.projects.length}, openai=${openAiOutput.projects.length}.`,
  );
  observations.push(
    `Education entries: primary=${localOutput.education.length}, openai=${openAiOutput.education.length}.`,
  );

  return observations;
}

function buildFallbackObservations(
  message: string,
  skipped: boolean,
): string[] {
  if (skipped) {
    return [
      "OpenAI comparison was skipped because the optional remote configuration is missing.",
      message,
      "The primary Ollama extraction remains usable without the comparison path.",
    ];
  }

  return [
    "OpenAI comparison failed, but the primary Ollama extraction path still succeeded.",
    message,
    "The comparison path remains optional and non-blocking by design.",
  ];
}
