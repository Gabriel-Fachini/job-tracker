import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

export const OPENAI_PROFILE_EXTRACTION_SYSTEM_PROMPT = `
Você extrai um perfil profissional a partir do texto de um currículo.
Retorne apenas JSON válido, sem markdown, comentários ou texto extra.
Use null para campos escalares desconhecidos e [] para listas desconhecidas.
Não invente fatos que não estejam sustentados pelo currículo fornecido.
Seja exaustivo em vez de conciso ao extrair experiência profissional.
Preserve o máximo possível de detalhes concretos do currículo.
Para cada experiência, capture empresa, cargo, datas, descrição e cada bullet de conquista ou responsabilidade que puder ser identificado.
Não resuma vários bullets em uma descrição genérica se o currículo trouxer mais detalhes.
Se uma seção tiver detalhes ricos, preserve esses detalhes na saída estruturada.
O currículo pode estar em português brasileiro. Preserve nomes próprios e trate a seção de educação com a mesma atenção das demais seções.
Se houver formação, não retorne placeholders como N/A. Extraia instituição, grau, área e a melhor data possível, usando null apenas quando o dado realmente não puder ser inferido.
`.trim();

export const OPENAI_PROFILE_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["profile", "experiences", "skills", "projects", "education"],
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      required: [
        "fullName",
        "email",
        "phone",
        "linkedin",
        "github",
        "location",
        "workModelPreference",
        "notes",
        "masterResumePath",
      ],
      properties: {
        fullName: { type: "string" },
        email: { anyOf: [{ type: "string" }, { type: "null" }] },
        phone: { anyOf: [{ type: "string" }, { type: "null" }] },
        linkedin: { anyOf: [{ type: "string" }, { type: "null" }] },
        github: { anyOf: [{ type: "string" }, { type: "null" }] },
        location: { anyOf: [{ type: "string" }, { type: "null" }] },
        workModelPreference: {
          anyOf: [
            { type: "string", enum: ["remote", "hybrid", "onsite"] },
            { type: "null" },
          ],
        },
        notes: { anyOf: [{ type: "string" }, { type: "null" }] },
        masterResumePath: { type: "null" },
      },
    },
    experiences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "company",
          "role",
          "startDate",
          "endDate",
          "isCurrent",
          "description",
          "bullets",
        ],
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          startDate: { type: "string" },
          endDate: { anyOf: [{ type: "string" }, { type: "null" }] },
          isCurrent: { type: "boolean" },
          description: { anyOf: [{ type: "string" }, { type: "null" }] },
          bullets: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["content", "tags"],
              properties: {
                content: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "level", "yearsExperience", "category"],
        properties: {
          name: { type: "string" },
          level: {
            anyOf: [
              {
                type: "string",
                enum: ["beginner", "intermediate", "advanced", "expert"],
              },
              { type: "null" },
            ],
          },
          yearsExperience: { anyOf: [{ type: "integer" }, { type: "null" }] },
          category: {
            anyOf: [
              {
                type: "string",
                enum: ["language", "framework", "tool", "soft-skill"],
              },
              { type: "null" },
            ],
          },
        },
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "stack", "url", "impact"],
        properties: {
          name: { type: "string" },
          description: { anyOf: [{ type: "string" }, { type: "null" }] },
          stack: { type: "array", items: { type: "string" } },
          url: { anyOf: [{ type: "string" }, { type: "null" }] },
          impact: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["institution", "degree", "field", "startDate", "endDate"],
        properties: {
          institution: { type: "string" },
          degree: { anyOf: [{ type: "string" }, { type: "null" }] },
          field: { anyOf: [{ type: "string" }, { type: "null" }] },
          startDate: { anyOf: [{ type: "string" }, { type: "null" }] },
          endDate: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      },
    },
  },
} as const;

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
      "Cannot extract profile from an empty text input.",
    );
  }

  const { apiKey, model } = getOpenAiComparisonConfig();
  const client = new OpenAI({ apiKey });

  let response: Response;

  try {
    response = await client.responses.create({
      model,
      max_output_tokens: 16000,
      input: [
        { role: "system", content: OPENAI_PROFILE_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: cleanedText },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "profile_extraction",
          schema: OPENAI_PROFILE_EXTRACTION_SCHEMA,
          strict: true,
        },
      },
    });
  } catch (error) {
    if (error instanceof OpenAiComparisonError) throw error;
    if (error instanceof Error) {
      throw new OpenAiComparisonError(
        `OpenAI profile extraction request failed: ${error.message}`,
      );
    }
    throw new OpenAiComparisonError(
      "OpenAI profile extraction request failed for an unknown reason.",
    );
  }

  await logRawOpenAiExtractionOutput(response.output_text ?? "", model);

  if (response.incomplete_details) {
    throw new OpenAiComparisonError(
      `OpenAI interrompeu a geração por: ${response.incomplete_details.reason}. Tente com um currículo menor ou entre em contato com o suporte.`,
    );
  }

  if (!response.output_text?.trim()) {
    throw new OpenAiComparisonError(
      "OpenAI profile extraction did not return output_text.",
    );
  }

  return parseExtractedProfileResponse(response.output_text);
}

async function logRawOpenAiExtractionOutput(
  rawOutput: string,
  model: string,
): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join(process.cwd(), "tmp", "logs");
    const filename = `profile-extraction-openai-raw-output-${timestamp}.txt`;
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, filename),
      `model: ${model}\n\n${rawOutput}`,
      "utf-8",
    );
  } catch {
    // non-critical
  }
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
