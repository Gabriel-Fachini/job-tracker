import "server-only";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen3:latest";

const WORK_MODEL_PREFERENCES = ["remote", "hybrid", "onsite"] as const;
const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
const SKILL_CATEGORIES = [
  "language",
  "framework",
  "tool",
  "soft-skill",
] as const;

type WorkModelPreference = (typeof WORK_MODEL_PREFERENCES)[number];
type SkillLevel = (typeof SKILL_LEVELS)[number];
type SkillCategory = (typeof SKILL_CATEGORIES)[number];
type JsonObject = Record<string, unknown>;

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

type CallLocalLlmOptions = {
  system?: string;
  format?: "json" | JsonObject;
  timeoutMs?: number;
};

type OllamaGenerateResponse = {
  response?: unknown;
  error?: unknown;
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

export function getOllamaConfig() {
  const baseUrl =
    process.env.OLLAMA_CPP_BASE_URL ??
    process.env.OLLAMA_BASE_URL ??
    DEFAULT_OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_CPP_MODEL ?? DEFAULT_OLLAMA_MODEL;

  if (!baseUrl) {
    throw new OllamaConfigurationError(
      "Missing OLLAMA_CPP_BASE_URL configuration.",
    );
  }

  if (!model) {
    throw new OllamaConfigurationError(
      "Missing OLLAMA_CPP_MODEL configuration.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
  };
}

export async function callLocalLlm(
  prompt: string,
  options: CallLocalLlmOptions = {},
): Promise<string> {
  const { baseUrl, model } = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30_000,
  );

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        system: options.system,
        format: options.format,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new OllamaRequestError(
        `Local model request failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (typeof data.response !== "string" || !data.response.trim()) {
      throw new OllamaRequestError(
        "Local model response did not include a valid response string.",
      );
    }

    return data.response;
  } catch (error) {
    if (error instanceof OllamaRequestError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new OllamaRequestError(
        "Local model request timed out after waiting for the response.",
      );
    }

    if (error instanceof Error) {
      throw new OllamaRequestError(
        `Failed to reach the local model runtime: ${error.message}`,
      );
    }

    throw new OllamaRequestError(
      "Failed to reach the local model runtime for an unknown reason.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractProfileFromText(
  rawText: string,
): Promise<ExtractedProfile> {
  const cleanedText = rawText.trim();

  if (!cleanedText) {
    throw new ProfileExtractionError(
      "Cannot extract a profile from an empty text input.",
    );
  }

  const response = await callLocalLlm(cleanedText, {
    system: PROFILE_EXTRACTION_SYSTEM_PROMPT,
    format: "json",
  });

  return validateExtractedProfile(parseJsonResponse(response));
}

const PROFILE_EXTRACTION_SYSTEM_PROMPT = `
You extract a professional profile from resume text.
Return only valid JSON with no markdown, comments, or extra prose.
Use null for unknown scalar fields and [] for unknown lists.
Do not invent facts that are not grounded in the provided resume text.

Return this exact shape:
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
    "Local model did not return a valid JSON object for profile extraction.",
  );
}

function validateExtractedProfile(value: JsonObject): ExtractedProfile {
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
        level: getOptionalEnum(skill, "level", SKILL_LEVELS),
        yearsExperience: getOptionalInteger(skill, "yearsExperience"),
        category: getOptionalEnum(skill, "category", SKILL_CATEGORIES),
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
    throw new ProfileExtractionError(`${path} must be an object.`);
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
    throw new ProfileExtractionError(`${key} must be an array.`);
  }

  return value;
}

function getRequiredString(source: JsonObject, key: string): string {
  const value = source[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new ProfileExtractionError(`${key} must be a non-empty string.`);
  }

  return value.trim();
}

function getOptionalString(source: JsonObject, key: string): string | null {
  const value = source[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProfileExtractionError(`${key} must be a string or null.`);
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
    throw new ProfileExtractionError(`${key} must be a boolean or null.`);
  }

  return value;
}

function getOptionalInteger(source: JsonObject, key: string): number | null {
  const value = source[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }

  throw new ProfileExtractionError(`${key} must be an integer or null.`);
}

function getStringArray(source: JsonObject, key: string): string[] {
  const values = getArray(source, key);

  return values.map((value, index) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new ProfileExtractionError(
        `${key}[${index}] must be a non-empty string.`,
      );
    }

    return value.trim();
  });
}

function getRequiredDateLike(source: JsonObject, key: string): string {
  const value = getRequiredString(source, key);

  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new ProfileExtractionError(`${key} must use the YYYY-MM format.`);
  }

  return value;
}

function getOptionalDateLike(source: JsonObject, key: string): string | null {
  const value = getOptionalString(source, key);

  if (value === null) {
    return null;
  }

  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new ProfileExtractionError(`${key} must use the YYYY-MM format.`);
  }

  return value;
}

function getOptionalEnum<const T extends readonly string[]>(
  source: JsonObject,
  key: string,
  allowedValues: T,
): T[number] | null {
  const value = getOptionalString(source, key);

  if (value === null) {
    return null;
  }

  if (!allowedValues.includes(value)) {
    throw new ProfileExtractionError(
      `${key} must be one of: ${allowedValues.join(", ")}.`,
    );
  }

  return value as T[number];
}
