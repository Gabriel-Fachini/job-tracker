import {
  callOllamaLlm,
  getOllamaConfig,
  unloadOllamaModelIfLocal,
} from "@/lib/ai/ollama";
import type { ProfileSnapshot } from "@/lib/profile/editor";

import {
  buildSignalAssessment,
  extractJobSignals,
} from "./signals";
import type {
  ClassificationContext,
  ExtractedJobDetail,
  JobLeadClassification,
  JobLeadSignals,
} from "./types";

export class JobLeadClassificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobLeadClassificationError";
  }
}

const JOB_LEAD_CLASSIFICATION_SYSTEM_PROMPT = `
Voce classifica vagas para um job tracker pessoal e local.
Retorne apenas JSON valido, sem markdown ou texto extra.
Nao invente requisitos, experiencia ou preferencias.
Priorize alta cobertura: se houver duvida, responda "review" em vez de "discarded".
Use "discarded" apenas quando houver desalinhamento claro e sustentado pelos sinais.
Se o perfil estiver incompleto, use "review" em vez de superestimar a confianca.
Decisoes validas:
- "interesting": encaixe claro com perfil e preferencias.
- "review": sinais mistos, dados insuficientes ou necessidade de verificacao manual.
- "discarded": desalinhamento claro.
O score deve ser um inteiro de 0 a 100.
O campo "reason" deve ser curto, objetivo e em portugues brasileiro.
Os arrays "matchedSignals", "riskSignals" e "missingSignals" devem conter frases curtas em portugues brasileiro.
`.trim();

const JOB_LEAD_CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "decision",
    "score",
    "reason",
    "matchedSignals",
    "riskSignals",
    "missingSignals",
  ],
  properties: {
    decision: {
      type: "string",
      enum: ["interesting", "review", "discarded"],
    },
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    reason: {
      type: "string",
      minLength: 1,
    },
    matchedSignals: {
      type: "array",
      items: { type: "string" },
    },
    riskSignals: {
      type: "array",
      items: { type: "string" },
    },
    missingSignals: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export async function classifyJobLead(
  job: ExtractedJobDetail,
  context: ClassificationContext,
): Promise<JobLeadClassification> {
  const profile = context.profile;
  const signals = extractJobSignals(job);
  const signalAssessment = buildSignalAssessment(signals, profile);

  if (!profile) {
    return {
      decision: "review",
      score: 40,
      reason: "Perfil principal ainda nao foi configurado para classificar com confianca.",
      matchedSignals: signalAssessment.matchedSignals,
      riskSignals: signalAssessment.riskSignals,
      missingSignals: [
        ...signalAssessment.missingSignals,
        "Perfil principal indisponivel",
      ],
    };
  }

  const config = getOllamaConfig();

  try {
    const response = await callOllamaLlm(
      buildClassificationPrompt(
        job,
        context.companyName,
        profile,
        signals,
        signalAssessment,
        context.feedbackSummary,
      ),
      {
        system: JOB_LEAD_CLASSIFICATION_SYSTEM_PROMPT,
        format: JOB_LEAD_CLASSIFICATION_JSON_SCHEMA,
        think: false,
        generationOptions: {
          temperature: 0,
        },
      },
    );

    return parseClassificationResponse(response, signalAssessment);
  } catch (error) {
    throw new JobLeadClassificationError(
      error instanceof Error
        ? error.message
        : "Falha na classificacao automatica do runtime Ollama.",
    );
  } finally {
    if (config.runtimeMode === "local") {
      try {
        await unloadOllamaModelIfLocal();
      } catch {
        // Sem impacto funcional para a varredura.
      }
    }
  }
}

function buildClassificationPrompt(
  job: ExtractedJobDetail,
  companyName: string,
  profile: ProfileSnapshot,
  signals: JobLeadSignals,
  signalAssessment: {
    matchedSignals: string[];
    riskSignals: string[];
    missingSignals: string[];
  },
  feedbackSummary: ClassificationContext["feedbackSummary"],
) {
  return JSON.stringify(
    {
      companyName,
      profile: summarizeProfile(profile),
      job: {
        title: job.title,
        description: job.description,
        workModel: job.workModel,
        seniority: job.seniority,
        locationText: job.locationText,
        salaryText: job.salaryText,
        sourceUrl: job.sourceUrl,
      },
      extractedSignals: {
        seniority: signals.detectedSeniority,
        workModels: signals.detectedWorkModels,
        employmentTypes: signals.employmentTypes,
        locationSignals: signals.locationSignals,
        jobFamily: signals.jobFamily,
        stackSignals: signals.stackSignals,
        positiveSignals: signals.positiveSignals,
        blockedSignals: signals.blockedSignals,
      },
      deterministicAssessment: signalAssessment,
      recentFeedback: feedbackSummary,
      criteria: [
        "Avalie compatibilidade de stack, senioridade, familia da vaga e modelo de trabalho.",
        "Considere preferencias explicitas do perfil e os sinais estruturados extraidos da vaga.",
        "Use review quando faltarem dados essenciais ou houver ambiguidade.",
        "Use discarded apenas para desalinhamento claro e sustentado.",
      ],
    },
    null,
    2,
  );
}

function summarizeProfile(profile: ProfileSnapshot) {
  return {
    fullName: profile.fullName,
    location: profile.location,
    workModelPreference: profile.workModelPreference,
    companyTypePreference: profile.companyTypePreference,
    valuesPreference: profile.valuesPreference,
    notes: profile.notes,
    recentRoles: profile.experiences.slice(0, 4).map((experience) => ({
      company: experience.company,
      role: experience.role,
      description: experience.description,
      bullets: experience.bullets.slice(0, 3).map((bullet) => bullet.content),
    })),
    topSkills: profile.skills.slice(0, 12).map((skill) => ({
      name: skill.name,
      level: skill.level,
      yearsExperience: skill.yearsExperience,
    })),
    projects: profile.projects.slice(0, 4).map((project) => ({
      name: project.name,
      stack: project.stack,
      impact: project.impact,
    })),
  };
}

export function parseClassificationResponse(
  response: string,
  fallbackSignals: {
    matchedSignals: string[];
    riskSignals: string[];
    missingSignals: string[];
  } = {
    matchedSignals: [],
    riskSignals: [],
    missingSignals: [],
  },
): JobLeadClassification {
  const normalizedPayload = normalizeJsonPayload(response);
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(normalizedPayload) as Record<string, unknown>;
  } catch {
    throw new JobLeadClassificationError(
      "O runtime Ollama retornou JSON invalido para a classificacao.",
    );
  }

  const decision = normalizeDecision(parsed.decision);
  const score =
    typeof parsed.score === "number"
      ? Math.max(0, Math.min(100, Math.round(parsed.score)))
      : 50;
  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : "Classificacao sem justificativa detalhada.";

  return {
    decision,
    score,
    reason,
    matchedSignals: parseStringArray(parsed.matchedSignals, fallbackSignals.matchedSignals),
    riskSignals: parseStringArray(parsed.riskSignals, fallbackSignals.riskSignals),
    missingSignals: parseStringArray(parsed.missingSignals, fallbackSignals.missingSignals),
  };
}

function normalizeJsonPayload(response: string) {
  const trimmed = response.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function parseStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeDecision(value: unknown): JobLeadClassification["decision"] {
  switch (value) {
    case "interesting":
    case "review":
    case "discarded":
      return value;
    default:
      return "review";
  }
}
