import { callOllamaLlm } from "@/lib/ai/ollama";
import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { ResumeAISelection } from "@/lib/latex/profile-adapter";

const SYSTEM_PROMPT = `Você é um especialista em currículos técnicos para engenheiros de software.
Dado um perfil de candidato e uma descrição de vaga, sua tarefa é:
1. Para cada experiência listada no perfil, selecionar e reescrever levemente os bullet points mais relevantes (mínimo 2, máximo 5) em formato STAR. Preserve números e métricas reais. Não invente dados.
2. Selecionar as habilidades mais relevantes para a vaga, agrupadas por categoria em português.
3. Compare as tecnologias mencionadas na descrição da vaga com as habilidades do candidato. Se houver tecnologias-chave da vaga (linguagens, frameworks, ferramentas) que NÃO constam nas habilidades do candidato, crie uma categoria extra chamada "Interesse Técnico" nas skills listando esses itens. Não invente experiência — apenas demonstre interesse. Isso é especialmente adequado para vagas júnior.

Retorne APENAS JSON válido neste formato exato (sem markdown, sem texto extra):
{
  "experiences": [
    { "company": "Nome Exato Da Empresa", "bullets": ["bullet 1", "bullet 2"] }
  ],
  "skills": [
    { "category": "Linguagens", "items": "TypeScript, Python" }
  ]
}

IMPORTANTE: Inclua TODAS as empresas do perfil no array experiences. Cada empresa deve ter pelo menos 2 bullets.`;

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
Selecione e reescreva os bullet points mais relevantes para esta vaga específica (STAR format). Selecione as habilidades mais relevantes organizadas por categoria em português (ex: "Linguagens", "Frameworks", "Ferramentas", "Cloud & DevOps"). Verifique tecnologias explicitamente citadas na descrição que não aparecem nas habilidades do candidato. Se encontrar, adicione categoria "Interesse Técnico" com elas.`;

  const raw = await callOllamaLlm(prompt, {
    system: SYSTEM_PROMPT,
    format: "json",
    generationOptions: { temperature: 0 },
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = JSON.parse(jsonStr);

  // Ollama sometimes wraps output in a top-level key
  if (parsed && !Array.isArray(parsed.experiences)) {
    const nested = parsed.result ?? parsed.output ?? parsed.data ?? parsed.response;
    if (nested && Array.isArray(nested.experiences)) parsed = nested;
  }

  return {
    experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
  } as ResumeAISelection;
}
