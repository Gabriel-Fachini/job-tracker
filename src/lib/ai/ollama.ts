import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const DEFAULT_OLLAMA_TIMEOUT_MS = 240_000;
const execFileAsync = promisify(execFile);

const WORK_MODEL_PREFERENCES = ["remote", "hybrid", "onsite"] as const;
const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
const SKILL_CATEGORIES = [
  "language",
  "framework",
  "tool",
  "soft-skill",
] as const;
const WORK_MODEL_ALIASES: Record<string, WorkModelPreference> = {
  remote: "remote",
  remoto: "remote",
  remota: "remote",
  hybrid: "hybrid",
  hibrido: "hybrid",
  hibrida: "hybrid",
  "hybrid/remote": "hybrid",
  onsite: "onsite",
  on_site: "onsite",
  presencial: "onsite",
};
const SKILL_LEVEL_ALIASES: Record<string, SkillLevel> = {
  beginner: "beginner",
  high: "advanced",
  basic: "beginner",
  junior: "beginner",
  entry_level: "beginner",
  entrylevel: "beginner",
  iniciante: "beginner",
  basico: "beginner",
  básico: "beginner",
  intermediate: "intermediate",
  mid: "intermediate",
  medium: "intermediate",
  pleno: "intermediate",
  intermediario: "intermediate",
  intermediário: "intermediate",
  advanced: "advanced",
  senior: "advanced",
  avancado: "advanced",
  avançado: "advanced",
  expert: "expert",
  especialista: "expert",
};
const SKILL_CATEGORY_ALIASES: Record<string, SkillCategory> = {
  language: "language",
  linguagem: "language",
  linguagens: "language",
  framework: "framework",
  frameworks: "framework",
  tool: "tool",
  tools: "tool",
  ferramenta: "tool",
  ferramentas: "tool",
  "soft-skill": "soft-skill",
  softskill: "soft-skill",
  softskills: "soft-skill",
  "soft skill": "soft-skill",
  "soft skills": "soft-skill",
  comportamental: "soft-skill",
};

type WorkModelPreference = (typeof WORK_MODEL_PREFERENCES)[number];
type SkillLevel = (typeof SKILL_LEVELS)[number];
type SkillCategory = (typeof SKILL_CATEGORIES)[number];
type JsonObject = Record<string, unknown>;
type OllamaRuntimeMode = "local" | "cloud";

export type ExtractedProfile = {
  profile: {
    fullName: string;
    email: string | null;
    phone: string | null;
    linkedin: string | null;
    github: string | null;
    location: string | null;
    workModelPreference: WorkModelPreference | null;
    notes: string | null;
    masterResumePath: string | null;
  };
  experiences: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    description: string | null;
    bullets: Array<{
      content: string;
      tags: string[];
    }>;
  }>;
  skills: Array<{
    name: string;
    level: SkillLevel | null;
    yearsExperience: number | null;
    category: SkillCategory | null;
  }>;
  projects: Array<{
    name: string;
    description: string | null;
    stack: string[];
    url: string | null;
    impact: string | null;
  }>;
  education: Array<{
    institution: string;
    degree: string | null;
    field: string | null;
    startDate: string | null;
    endDate: string | null;
  }>;
};

type CallOllamaLlmOptions = {
  system?: string;
  format?: "json" | JsonObject;
  timeoutMs?: number;
  think?: boolean;
  generationOptions?: JsonObject;
  keepAlive?: string | number;
};

export type OllamaRuntimeConfig = {
  runtimeMode: OllamaRuntimeMode;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  timeoutMs: number;
};

type OllamaGenerateResponse = {
  response?: unknown;
  error?: unknown;
  done_reason?: unknown;
};

export class OllamaConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaConfigurationError";
  }
}

export class OllamaRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaRequestError";
  }
}

export class ProfileExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileExtractionError";
  }
}

export function getOllamaConfig(): OllamaRuntimeConfig {
  const runtimeMode = normalizeRuntimeMode(process.env.OLLAMA_RUNTIME_MODE);
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
  const model = process.env.OLLAMA_MODEL?.trim();
  const apiKey = process.env.OLLAMA_API_KEY?.trim() ?? "";
  const timeoutMs = parseTimeoutMs(process.env.OLLAMA_TIMEOUT_MS);

  if (!runtimeMode) {
    throw new OllamaConfigurationError(
      "Missing or invalid OLLAMA_RUNTIME_MODE configuration. Use \"local\" or \"cloud\".",
    );
  }

  if (!baseUrl) {
    throw new OllamaConfigurationError(
      "Missing OLLAMA_BASE_URL configuration for the Ollama runtime.",
    );
  }

  if (!model) {
    throw new OllamaConfigurationError(
      "Missing OLLAMA_MODEL configuration for the Ollama runtime.",
    );
  }

  if (runtimeMode === "cloud" && !apiKey) {
    throw new OllamaConfigurationError(
      "Missing OLLAMA_API_KEY configuration for Ollama Cloud.",
    );
  }

  return {
    runtimeMode,
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    apiKey: apiKey || null,
    timeoutMs,
  };
}

function normalizeRuntimeMode(value: string | undefined): OllamaRuntimeMode | null {
  switch (value?.trim().toLowerCase()) {
    case "local":
      return "local";
    case "cloud":
      return "cloud";
    default:
      return null;
  }
}

function parseTimeoutMs(value: string | undefined) {
  if (!value) {
    return DEFAULT_OLLAMA_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_OLLAMA_TIMEOUT_MS;
}

function createOllamaHeaders(config: OllamaRuntimeConfig) {
  return {
    "Content-Type": "application/json",
    ...(config.runtimeMode === "cloud" && config.apiKey
      ? { Authorization: `Bearer ${config.apiKey}` }
      : {}),
  };
}

export async function callOllamaLlm(
  prompt: string,
  options: CallOllamaLlmOptions = {},
): Promise<string> {
  const config = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? config.timeoutMs,
  );

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: "POST",
      headers: createOllamaHeaders(config),
      body: JSON.stringify({
        model: config.model,
        prompt,
        system: options.system,
        format: options.format,
        think: options.think,
        stream: false,
        options: options.generationOptions,
        keep_alive: options.keepAlive ?? 0,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new OllamaRequestError(
        `Ollama request failed with status ${response.status} for model "${config.model}". ${errorBody}`.trim(),
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (typeof data.response !== "string" || !data.response.trim()) {
      throw new OllamaRequestError(
        "O runtime Ollama nao retornou uma resposta textual valida.",
      );
    }

    return data.response;
  } catch (error) {
    if (error instanceof OllamaRequestError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new OllamaRequestError(
        "O runtime Ollama excedeu o tempo limite configurado para responder.",
      );
    }

    if (error instanceof Error) {
      throw new OllamaRequestError(
        `Falha ao acessar o runtime Ollama: ${error.message}`,
      );
    }

    throw new OllamaRequestError(
      "Falha ao acessar o runtime Ollama por um motivo desconhecido.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function unloadOllamaModelIfLocal(): Promise<void> {
  const config = getOllamaConfig();

  if (config.runtimeMode !== "local") {
    return;
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: "POST",
      headers: createOllamaHeaders(config),
      body: JSON.stringify({
        model: config.model,
        prompt: "",
        stream: false,
        keep_alive: 0,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new OllamaRequestError(
        `Falha ao desalocar o modelo Ollama com status ${response.status} para o modelo "${config.model}". ${errorBody}`.trim(),
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (data.done_reason !== "unload") {
      throw new OllamaRequestError(
        `A API do Ollama respondeu sem confirmar o descarregamento do modelo "${config.model}".`,
      );
    }
  } catch (error) {
    try {
      await execFileAsync("ollama", ["stop", config.model]);
      return;
    } catch (stopError) {
      if (error instanceof OllamaRequestError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new OllamaRequestError(
          `Falha ao desalocar o modelo Ollama local: ${error.message}`,
        );
      }

      if (stopError instanceof Error) {
        throw new OllamaRequestError(
          `Falha ao desalocar o modelo Ollama local por API e por CLI: ${stopError.message}`,
        );
      }

      throw new OllamaRequestError(
        "Falha ao desalocar o modelo Ollama local por um motivo desconhecido.",
      );
    }
  }
}

export async function extractProfileFromText(
  rawText: string,
  options: { timeoutMs?: number } = {},
): Promise<ExtractedProfile> {
  const config = getOllamaConfig();
  const cleanedText = rawText.trim();

  if (!cleanedText) {
    throw new ProfileExtractionError(
      "Não é possível extrair um perfil a partir de um texto vazio.",
    );
  }

  try {
    const response = await callOllamaLlm(cleanedText, {
      system: PROFILE_EXTRACTION_SYSTEM_PROMPT,
      format: PROFILE_EXTRACTION_JSON_SCHEMA,
      timeoutMs: options.timeoutMs ?? config.timeoutMs,
      think: false,
      generationOptions: {
        temperature: 0,
      },
    });

    await logRawProfileExtractionOutput(response);
    return parseExtractedProfileResponse(response);
  } finally {
    if (config.runtimeMode === "local") {
      try {
        await unloadOllamaModelIfLocal();
      } catch (error) {
        console.warn(
          "Falha ao desalocar o modelo Ollama local ao final da extracao.",
          error,
        );
      }
    }
  }
}

export const PROFILE_EXTRACTION_SYSTEM_PROMPT = `
Voce extrai um perfil profissional a partir do texto de um curriculo.
Retorne apenas JSON valido, sem markdown, comentarios ou texto extra.
Use null para campos escalares desconhecidos e [] para listas desconhecidas.
Nao invente fatos que nao estejam sustentados pelo curriculo fornecido.
O raciocinio deve permanecer desabilitado. Nao exponha nenhuma cadeia de pensamento.
Seja exaustivo em vez de conciso ao extrair experiencia profissional.
Preserve o maximo possivel de detalhes concretos do curriculo.
Para cada experiencia, capture empresa, cargo, datas, descricao e cada bullet de conquista ou responsabilidade que puder ser identificado.
Nao resuma varios bullets em uma descricao generica se o curriculo trouxer mais detalhes.
Se uma secao tiver detalhes ricos, preserve esses detalhes na saida estruturada.
O curriculo pode estar em portugues brasileiro. Preserve nomes proprios e trate a secao de educacao com a mesma atencao das demais secoes.
Se houver formacao, nao retorne placeholders como N/A. Extraia instituicao, grau, area e a melhor data possivel, usando null apenas quando o dado realmente nao puder ser inferido.

Retorne exatamente este shape:
{
  "profile": {
    "fullName": "string",
    "email": "string | null",
    "phone": "string | null",
    "linkedin": "string | null",
    "github": "string | null",
    "location": "string | null",
    "workModelPreference": "remote | hybrid | onsite | null",
    "notes": "string | null",
    "masterResumePath": null
  },
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM | null",
      "isCurrent": false,
      "description": "string | null",
      "bullets": [
        {
          "content": "string",
          "tags": ["string"]
        }
      ]
    }
  ],
  "skills": [
    {
      "name": "string",
      "level": "beginner | intermediate | advanced | expert | null",
      "yearsExperience": 0,
      "category": "language | framework | tool | soft-skill | null"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string | null",
      "stack": ["string"],
      "url": "string | null",
      "impact": "string | null"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string | null",
      "field": "string | null",
      "startDate": "YYYY-MM | null",
      "endDate": "YYYY-MM | null"
    }
  ]
}
`.trim();

export const PROFILE_EXTRACTION_JSON_SCHEMA = {
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
        email: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        linkedin: { type: ["string", "null"] },
        github: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        workModelPreference: {
          type: ["string", "null"],
          enum: [...WORK_MODEL_PREFERENCES, null],
        },
        notes: { type: ["string", "null"] },
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
          endDate: { type: ["string", "null"] },
          isCurrent: { type: "boolean" },
          description: { type: ["string", "null"] },
          bullets: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["content", "tags"],
              properties: {
                content: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                },
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
            type: ["string", "null"],
            enum: [...SKILL_LEVELS, null],
          },
          yearsExperience: { type: ["integer", "null"] },
          category: {
            type: ["string", "null"],
            enum: [...SKILL_CATEGORIES, null],
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
          description: { type: ["string", "null"] },
          stack: {
            type: "array",
            items: { type: "string" },
          },
          url: { type: ["string", "null"] },
          impact: { type: ["string", "null"] },
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
          degree: { type: ["string", "null"] },
          field: { type: ["string", "null"] },
          startDate: { type: ["string", "null"] },
          endDate: { type: ["string", "null"] },
        },
      },
    },
  },
} satisfies JsonObject;

export function parseExtractedProfileResponse(
  rawResponse: string,
): ExtractedProfile {
  return validateExtractedProfile(parseJsonResponse(rawResponse));
}

function parseJsonResponse(rawResponse: string): JsonObject {
  const normalizedResponse = rawResponse.trim();
  const withoutCodeFence = normalizedResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [
    withoutCodeFence,
    sliceOuterJsonObject(withoutCodeFence),
    sliceOuterJsonObject(normalizedResponse),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;

      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  throw new ProfileExtractionError(
    "O runtime Ollama nao retornou um JSON valido para a extracao do perfil.",
  );
}

export function validateExtractedProfile(
  value: JsonObject,
): ExtractedProfile {
  const profile = getRecord(value, "profile");

  return {
    profile: {
      fullName: getRequiredString(profile, "fullName"),
      email: getOptionalString(profile, "email"),
      phone: getOptionalString(profile, "phone"),
      linkedin: getOptionalString(profile, "linkedin"),
      github: getOptionalString(profile, "github"),
      location: getOptionalString(profile, "location"),
      workModelPreference: getOptionalEnum(
        profile,
        "workModelPreference",
        WORK_MODEL_PREFERENCES,
        WORK_MODEL_ALIASES,
      ),
      notes: getOptionalString(profile, "notes"),
      masterResumePath: getOptionalString(profile, "masterResumePath"),
    },
    experiences: getArray(value, "experiences").map((item, index) => {
      const experience = getNestedRecord(item, `experiences[${index}]`);

      return {
        company: getRequiredString(experience, "company"),
        role: getRequiredString(experience, "role"),
        startDate: getRequiredDateLike(experience, "startDate"),
        endDate: getOptionalDateLike(experience, "endDate"),
        isCurrent: getOptionalBoolean(experience, "isCurrent") ?? false,
        description: getOptionalString(experience, "description"),
        bullets: getArray(experience, "bullets").map((bullet, bulletIndex) => {
          const bulletRecord = getNestedRecord(
            bullet,
            `experiences[${index}].bullets[${bulletIndex}]`,
          );

          return {
            content: getRequiredString(bulletRecord, "content"),
            tags: getStringArray(bulletRecord, "tags"),
          };
        }),
      };
    }),
    skills: getArray(value, "skills").map((item, index) => {
      const skill = getNestedRecord(item, `skills[${index}]`);

      return {
        name: getRequiredString(skill, "name"),
        level: getOptionalEnum(skill, "level", SKILL_LEVELS, SKILL_LEVEL_ALIASES),
        yearsExperience: getOptionalInteger(skill, "yearsExperience"),
        category: getOptionalEnum(
          skill,
          "category",
          SKILL_CATEGORIES,
          SKILL_CATEGORY_ALIASES,
        ),
      };
    }),
    projects: getArray(value, "projects").map((item, index) => {
      const project = getNestedRecord(item, `projects[${index}]`);

      return {
        name: getRequiredString(project, "name"),
        description: getOptionalString(project, "description"),
        stack: getStringArray(project, "stack"),
        url: getOptionalString(project, "url"),
        impact: getOptionalString(project, "impact"),
      };
    }),
    education: getArray(value, "education").map((item, index) => {
      const education = getNestedRecord(item, `education[${index}]`);

      return {
        institution: getRequiredString(education, "institution"),
        degree: getOptionalString(education, "degree"),
        field: getOptionalString(education, "field"),
        startDate: getOptionalDateLike(education, "startDate"),
        endDate: getOptionalDateLike(education, "endDate"),
      };
    }),
  };
}

function sliceOuterJsonObject(value: string): string | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedRecord(value: unknown, path: string): JsonObject {
  if (!isRecord(value)) {
    throw new ProfileExtractionError(`${path} deve ser um objeto.`);
  }

  return value;
}

function getRecord(source: JsonObject, key: string): JsonObject {
  return getNestedRecord(source[key], key);
}

function getArray(source: JsonObject, key: string): unknown[] {
  const value = source[key];

  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ProfileExtractionError(`${key} deve ser uma lista.`);
  }

  return value;
}

function getRequiredString(source: JsonObject, key: string): string {
  const value = source[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new ProfileExtractionError(`${key} deve ser uma string não vazia.`);
  }

  return value.trim();
}

function getOptionalString(source: JsonObject, key: string): string | null {
  const value = source[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProfileExtractionError(`${key} deve ser uma string ou null.`);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getOptionalBoolean(source: JsonObject, key: string): boolean | null {
  const value = source[key];

  if (value == null) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new ProfileExtractionError(`${key} deve ser um boolean ou null.`);
  }

  return value;
}

function getOptionalInteger(source: JsonObject, key: string): number | null {
  const value = source[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value <= 0 ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const normalized = normalizeLooseScalar(trimmed);

    if (
      normalized === "" ||
      [
        "n_a",
        "na",
        "none",
        "null",
        "nil",
        "unknown",
        "desconhecido",
        "not_specified",
        "unspecified",
        "nao_informado",
        "não_informado",
        "not_informed",
        "-",
      ].includes(normalized)
    ) {
      return null;
    }

    if (/^-?\d+$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      return parsed <= 0 ? null : parsed;
    }

    const leadingInteger = trimmed.match(/-?\d+/);

    if (leadingInteger) {
      const parsed = Number.parseInt(leadingInteger[0], 10);
      return parsed <= 0 ? null : parsed;
    }
  }

  throw new ProfileExtractionError(`${key} deve ser um inteiro ou null.`);
}

function getStringArray(source: JsonObject, key: string): string[] {
  const values = getArray(source, key);

  return values.map((value, index) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new ProfileExtractionError(
        `${key}[${index}] deve ser uma string não vazia.`,
      );
    }

    return value.trim();
  });
}

function getRequiredDateLike(source: JsonObject, key: string): string {
  const value = getRequiredString(source, key);
  const normalized = normalizeDateLike(value, false, "start");

  if (!normalized) {
    throw new ProfileExtractionError(
      `${key} deve usar ou ser convertível para o formato YYYY-MM.`,
    );
  }

  return normalized;
}

function getOptionalDateLike(source: JsonObject, key: string): string | null {
  const value = getOptionalString(source, key);

  if (value === null) {
    return null;
  }

  const normalized = normalizeDateLike(value, true, "end");

  if (normalized === null) {
    return null;
  }

  return normalized;
}

function getOptionalEnum<const T extends readonly string[]>(
  source: JsonObject,
  key: string,
  allowedValues: T,
  aliases?: Record<string, T[number]>,
): T[number] | null {
  const value = getOptionalString(source, key);

  if (value === null) {
    return null;
  }

  const normalizedValue = normalizeEnumValue(value, aliases);

  if (allowedValues.includes(normalizedValue as T[number])) {
    return normalizedValue as T[number];
  }

  if (!allowedValues.includes(value as T[number])) {
    throw new ProfileExtractionError(
      `${key} deve ser um destes valores: ${allowedValues.join(", ")}.`,
    );
  }

  return value as T[number];
}

function normalizeEnumValue(
  value: string,
  aliases?: Record<string, string>,
): string {
  if (!aliases) {
    return value;
  }

  const normalizedKey = normalizeLooseScalar(value);

  return aliases[normalizedKey] ?? value;
}

function normalizeLooseScalar(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[./]/g, "_")
    .replace(/\s+/g, "_");
}

function normalizeDateLike(
  value: string,
  allowCurrentAsNull: boolean,
  rangeSide: "start" | "end",
): string | null {
  const trimmed = value.trim();
  const normalizedText = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const normalizedScalar = normalizeLooseScalar(trimmed);

  if (
    allowCurrentAsNull &&
    [
      "n_a",
      "na",
      "none",
      "null",
      "nil",
      "unknown",
      "desconhecido",
      "not_specified",
      "unspecified",
      "nao_informado",
      "não_informado",
      "not_informed",
      "-",
      "sem_informacao",
      "sem_data",
    ].includes(normalizedScalar)
  ) {
    return null;
  }

  if (
    allowCurrentAsNull &&
    [
      "current",
      "present",
      "atual",
      "presente",
      "ongoing",
      "hoje",
      "momento_atual",
      "ate_o_momento",
      "ate_momento",
      "ate_atual",
      "atualmente",
      "current_role",
      "current_position",
    ].includes(normalizedScalar)
  ) {
    return null;
  }

  if (
    allowCurrentAsNull &&
    /(atual|presente|present|current|ongoing|atualmente)/i.test(normalizedText)
  ) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}\/\d{2}$/.test(trimmed)) {
    return trimmed.replace("/", "-");
  }

  const directMonthYear = trimmed.match(/\b(\d{2})[/-](\d{4})\b/);
  if (directMonthYear) {
    const month = directMonthYear[1];
    const year = directMonthYear[2];

    if (Number(month) >= 1 && Number(month) <= 12) {
      return `${year}-${month}`;
    }
  }

  const yearMonthAnywhere = trimmed.match(/\b(\d{4})[/-](\d{2})\b/);
  if (yearMonthAnywhere) {
    const year = yearMonthAnywhere[1];
    const month = yearMonthAnywhere[2];

    if (Number(month) >= 1 && Number(month) <= 12) {
      return `${year}-${month}`;
    }
  }

  const dateRangeMatch = trimmed.match(
    /\s(?:-|–|—|ate|até|to)\s/i,
  );

  if (dateRangeMatch) {
    const parts = trimmed
      .split(/\s(?:-|–|—|ate|até|to)\s/i)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const targetPart =
        rangeSide === "start" ? parts[0] : parts[parts.length - 1];

      if (targetPart) {
        const normalizedTargetPart = normalizeDateLike(
          targetPart,
          allowCurrentAsNull,
          rangeSide,
        );

        if (normalizedTargetPart !== null) {
          return normalizedTargetPart;
        }

        if (allowCurrentAsNull) {
          return null;
        }
      }
    }
  }

  const monthNames: Record<string, string> = {
    jan: "01",
    janeiro: "01",
    january: "01",
    fev: "02",
    fevereiro: "02",
    feb: "02",
    february: "02",
    mar: "03",
    março: "03",
    marco: "03",
    march: "03",
    abr: "04",
    abril: "04",
    apr: "04",
    april: "04",
    mai: "05",
    maio: "05",
    may: "05",
    jun: "06",
    junho: "06",
    june: "06",
    jul: "07",
    julho: "07",
    july: "07",
    ago: "08",
    agosto: "08",
    aug: "08",
    august: "08",
    set: "09",
    setembro: "09",
    sep: "09",
    september: "09",
    out: "10",
    outubro: "10",
    oct: "10",
    october: "10",
    nov: "11",
    novembro: "11",
    november: "11",
    dez: "12",
    dezembro: "12",
    dec: "12",
    december: "12",
  };

  const monthTextMatch =
    normalizedText.match(
      /\b([a-zç]{3,12})\s+de\s+(\d{4})\b|\b([a-zç]{3,12})\s+(\d{4})\b/,
    ) ?? null;

  if (monthTextMatch) {
    const monthToken = monthTextMatch[1] ?? monthTextMatch[3];
    const yearToken = monthTextMatch[2] ?? monthTextMatch[4];
    const month = monthToken ? monthNames[monthToken] : undefined;

    if (month && yearToken) {
      return `${yearToken}-${month}`;
    }
  }

  const yearOnlyMatch = trimmed.match(/\b(19|20)\d{2}\b/);
  if (yearOnlyMatch) {
    return `${yearOnlyMatch[0]}-01`;
  }

  return null;
}

async function logRawProfileExtractionOutput(rawOutput: string) {
  try {
    const logDirectory = path.join(process.cwd(), "tmp", "logs");
    await mkdir(logDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(
      path.join(logDirectory, `profile-extraction-raw-output-${timestamp}.txt`),
      rawOutput,
    );
  } catch (error) {
    console.warn("Falha ao gravar o output bruto da extração de perfil.", error);
  }
}
