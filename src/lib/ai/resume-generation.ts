import { callOllamaLlm } from "@/lib/ai/ollama";
import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { ResumeAISelection } from "@/lib/latex/profile-adapter";

const SYSTEM_PROMPT = `Você é um especialista em currículos técnicos para engenheiros de software.
Dado um perfil de candidato e uma descrição de vaga, sua tarefa é:
1. Para cada experiência listada no perfil, selecionar e reescrever levemente os bullet points mais relevantes (mínimo 2, máximo 5) em formato STAR. Preserve números e métricas reais. Não invente dados.
2. Selecionar as habilidades mais relevantes para a vaga, agrupadas por categoria em português.
3. Compare as tecnologias mencionadas na descrição da vaga com as habilidades do candidato. Para tecnologias-chave da vaga que NÃO constam nas habilidades profissionais:
   - Se o candidato tem um projeto pessoal com essa tecnologia (listado abaixo), crie uma categoria "Projetos & Experiência Prática" nas skills com entradas no formato "Tecnologia — Nome do Projeto" (ex: "React 19 — Valorize UI").
   - Se não há projeto com essa tecnologia, crie categoria "Interesse Técnico" listando o item.
   Não invente experiência. Isso é especialmente adequado para vagas júnior.

Retorne APENAS JSON válido neste formato exato (sem markdown, sem texto extra):
{
  "experiences": [
    { "company": "Nome Exato Da Empresa", "bullets": ["bullet 1", "bullet 2"] }
  ],
  "skills": [
    { "category": "Linguagens", "items": "TypeScript, Python" }
  ],
  "projects": [
    { "name": "Nome Exato Do Projeto", "reason": "curta justificativa opcional" }
  ]
}

IMPORTANTE:
- Inclua TODAS as empresas do perfil no array experiences. Cada empresa deve ter pelo menos 2 bullets.
- Nao transforme projetos em secao fixa do curriculo.
- Preencha "projects" apenas quando 1 ou 2 projetos tiverem aderencia direta com a vaga.
- Se projeto servir apenas para reforcar skill, deixe-o fora de "projects" e use-o somente em "skills".`;

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

  const projectsText = profile.projects.length > 0
    ? profile.projects
        .map((p) => {
          const stack = p.stack.length > 0 ? p.stack.join(", ") : "—";
          return `- ${p.name}: ${stack}`;
        })
        .join("\n")
    : "Nenhum projeto cadastrado.";

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

### Projetos Pessoais (tecnologias praticadas fora do trabalho formal):
${projectsText}

## INSTRUÇÃO
Selecione e reescreva os bullet points mais relevantes para esta vaga específica (STAR format). Selecione as habilidades mais relevantes organizadas por categoria em português (ex: "Linguagens", "Frameworks", "Ferramentas", "Cloud & DevOps"). Verifique tecnologias explicitamente citadas na descrição que não aparecem nas habilidades profissionais do candidato. Se o candidato tem projeto pessoal com essa tecnologia, adicione categoria "Projetos & Experiência Prática" com entradas "Tecnologia — Projeto". Caso contrário, adicione categoria "Interesse Técnico". Proponha no maximo 2 projetos em "projects" e somente quando eles merecerem aparecer como conteudo proprio do curriculo para esta vaga.`;

  const raw = await callOllamaLlm(prompt, {
    system: SYSTEM_PROMPT,
    format: "json",
    generationOptions: { temperature: 0 },
  });

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return parseResumeSelectionResponse(jsonStr);
}

export function parseResumeSelectionResponse(response: string): ResumeAISelection {
  const jsonStr = response.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

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
    projects: Array.isArray(parsed.projects)
      ? parsed.projects
          .filter(
            (project: unknown): project is { name?: unknown; reason?: unknown } =>
              typeof project === "object" && project !== null,
          )
          .flatMap((project) => {
            const name =
              typeof project.name === "string" && project.name.trim()
                ? project.name.trim()
                : null;

            if (!name) {
              return [];
            }

            return [
              {
                name,
                reason:
                  typeof project.reason === "string" && project.reason.trim()
                    ? project.reason.trim()
                    : undefined,
              },
            ];
          })
          .slice(0, 2)
      : [],
  };
}
