import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { ResumeTemplateData } from "./types";

export type ResumeAISelection = {
  experiences: Array<{ company: string; bullets: string[] }>;
  skills: Array<{ category: string; items: string }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  language: "Linguagens",
  framework: "Frameworks",
  tool: "Ferramentas",
  "soft-skill": "Soft Skills",
};

function formatDate(yyyyMm: string | null): string {
  if (!yyyyMm) return "";
  const [year, month] = yyyyMm.split("-");
  if (!month) return year ?? yyyyMm;
  return `${month}/${year}`;
}

export function buildResumeData(
  profile: ProfileSnapshot,
  aiSelection: ResumeAISelection,
): ResumeTemplateData {
  const bulletsByCompany = new Map<string, string[]>();
  for (const exp of aiSelection.experiences) {
    bulletsByCompany.set(exp.company.toLowerCase(), exp.bullets);
  }

  return {
    fullName: profile.fullName,
    email: profile.email ?? undefined,
    phone: profile.phone ?? undefined,
    linkedin: profile.linkedin ?? undefined,
    github: profile.github ?? undefined,
    location: profile.location ?? undefined,

    experiences: profile.experiences.map((exp) => {
      const key = exp.company.toLowerCase();
      const aiBullets = bulletsByCompany.get(key) ?? [];
      return {
        company: exp.company,
        role: exp.role,
        startDate: formatDate(exp.startDate),
        endDate: exp.isCurrent ? "Atual" : formatDate(exp.endDate),
        bullets: aiBullets.map((content) => ({ content })),
      };
    }),

    skills: aiSelection.skills,

    languages: [
      { name: "Português", level: "Nativo" },
      { name: "Inglês", level: "Avançado" },
    ],

    projects: profile.projects.map((p) => ({
      name: p.name,
      url: p.url ?? undefined,
      stack: p.stack.length > 0 ? p.stack.join(", ") : undefined,
      description: p.description ?? undefined,
      impact: p.impact ?? undefined,
    })),

    education: profile.education.map((e) => ({
      institution: e.institution,
      degree: e.degree ?? undefined,
      field: e.field ?? undefined,
      period:
        e.startDate && e.endDate
          ? `${formatDate(e.startDate)} — ${formatDate(e.endDate)}`
          : (e.endDate ?? undefined),
      location: "Brasil",
    })),
  };
}

export function profileSkillsToText(profile: ProfileSnapshot): string {
  const byCategory = new Map<string, string[]>();
  for (const skill of profile.skills) {
    const cat = CATEGORY_LABELS[skill.category ?? ""] ?? "Outros";
    const list = byCategory.get(cat) ?? [];
    list.push(skill.name);
    byCategory.set(cat, list);
  }
  return Array.from(byCategory.entries())
    .map(([cat, items]) => `${cat}: ${items.join(", ")}`)
    .join("\n");
}
