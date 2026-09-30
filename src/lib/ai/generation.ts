import { callOllamaLlm, formatJobDescriptionWithOllama } from "@/lib/ai/ollama";
import {
  callOpenAiText,
  getOpenAiGenerationModel,
  type OpenAiResponsesClient,
} from "@/lib/ai/openai-runtime";

/**
 * Generative tasks (resume selection, cover letter, free-text form drafts, the
 * "Formatar" button) go through one switch: `GENERATION_ENGINE` = `openai`
 * (default, model `OPENAI_GENERATION_MODEL`) or `ollama` (`OLLAMA_MODEL`).
 */

export type GenerationEngine = "openai" | "ollama";

export class GenerationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationConfigurationError";
  }
}

export function getGenerationEngine(
  env: Record<string, string | undefined> = process.env,
): GenerationEngine {
  const value = env.GENERATION_ENGINE?.trim().toLowerCase();

  if (!value || value === "openai") {
    return "openai";
  }

  if (value === "ollama") {
    return "ollama";
  }

  throw new GenerationConfigurationError(
    `GENERATION_ENGINE inválido: "${env.GENERATION_ENGINE}". Use openai ou ollama.`,
  );
}

export type GenerateOptions = {
  system: string;
  prompt: string;
  /** Ask for a JSON object (the prompt must describe it). */
  json?: boolean;
  /** Low temperature for extraction-like tasks (Ollama only: OpenAI reasoning models fix it). */
  temperature?: number;
  maxOutputTokens?: number;
  label?: string;
  engine?: GenerationEngine;
  client?: OpenAiResponsesClient;
};

export async function generateText(options: GenerateOptions): Promise<string> {
  const engine = options.engine ?? getGenerationEngine();

  if (engine === "ollama") {
    return callOllamaLlm(options.prompt, {
      system: options.system,
      format: options.json ? "json" : undefined,
      think: false,
      generationOptions: { temperature: options.temperature ?? 0.1 },
    });
  }

  const result = await callOpenAiText({
    model: getOpenAiGenerationModel(),
    system: options.system,
    user: options.prompt,
    json: options.json,
    maxOutputTokens: options.maxOutputTokens,
    client: options.client,
    label: options.label ?? "generation",
  });

  return result.outputText;
}

const FORMAT_DESCRIPTION_SYSTEM_PROMPT = `Você reformata descrições de vaga em markdown limpo e objetivo.
Use ## para seções (Responsabilidades, Requisitos, Diferenciais, Benefícios, Sobre a empresa).
Use listas com \`-\`. Use **negrito** para tecnologias e termos-chave.
Remova cabeçalhos, rodapés, links de candidatura, textos institucionais desnecessários e ruídos de formatação.
NÃO invente, altere ou parafraseie conteúdo relevante.
Mantenha o idioma original.
Retorne apenas o markdown, sem cercas \`\`\`.`;

/** The "Formatar" button of the application screen. */
export async function formatJobDescription(
  rawText: string,
  options: { engine?: GenerationEngine; client?: OpenAiResponsesClient } = {},
): Promise<string> {
  const cleaned = rawText.trim();
  const engine = options.engine ?? getGenerationEngine();

  if (!cleaned) {
    throw new Error("Não é possível formatar uma descrição vazia.");
  }

  if (engine === "ollama") {
    return formatJobDescriptionWithOllama(cleaned);
  }

  return generateText({
    system: FORMAT_DESCRIPTION_SYSTEM_PROMPT,
    prompt: cleaned,
    maxOutputTokens: 4000,
    engine,
    client: options.client,
    label: "format-description",
  });
}
