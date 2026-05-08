import { callOllamaLlm } from "@/lib/ai/ollama";
import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { ResumeAISelection } from "@/lib/latex/profile-adapter";

const SYSTEM_PROMPT = `Você é um especialista em currículos técnicos para engenheiros de software.
Dado um perfil de candidato e uma descrição de vaga, sua tarefa é:
1. Para cada experiência, selecionar e reescrever levemente os bullet points mais relevantes (mínimo 2, máximo 5) em formato STAR (Situação, Tarefa, Ação, Resultado). Preserve números e métricas reais. Não invente dados.
2. Selecionar as categorias e habilidades mais relevantes para a vaga, organizadas por categoria com label em português.

Retorne APENAS o JSON estruturado, sem explicações.`;

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["experiences", "skills"],
  properties: {
    experiences: {
      type: "array",
      items: {
        type: "object",
        required: ["company", "bullets"],
        properties: {
          company: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        required: ["category", "items"],
        properties: {
          category: { type: "string" },
          items: { type: "string" },
        },
      },
    },
  },
};

export async function generateResumeSelection(
  profile: ProfileSnapshot,
  job: { title: string; description: string; company: string },
): Promise<ResumeAISelection> {
  const experiencesText = profile.experiences
    .map((exp) => {
      const header = `${exp.role} @ ${exp.company} (${exp.startDate} – ${exp.isCurrent ? "atual" : (exp.endDate ?? "?")})`;
      const bullets = exp.bullets.map((b) => `  - ${b.content}`).join("\n");
      return `${header}\n${bullets}`;
    })
    .join("\n\n");

  const skillsText = profile.skills
    .map((s) => `${s.category ?? "other"}: ${s.name}`)
    .join(", ");

  const prompt = `## VAGA
Empresa: ${job.company}
Título: ${job.title}
Descrição:
${job.description}

## PERFIL DO CANDIDATO

### Experiências com bullet points:
${experiencesText}

### Habilidades disponíveis:
${skillsText}

## INSTRUÇÃO
Selecione e reescreva os bullet points mais relevantes para esta vaga específica (STAR format). Selecione as habilidades mais relevantes organizadas por categoria em português (ex: "Linguagens", "Frameworks", "Ferramentas", "Cloud & DevOps").`;

  const raw = await callOllamaLlm(prompt, {
    system: SYSTEM_PROMPT,
    format: OUTPUT_SCHEMA,
    generationOptions: { temperature: 0 },
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const parsed = JSON.parse(jsonStr) as ResumeAISelection;
  return parsed;
}
