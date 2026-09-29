import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { ResumeLanguage, ResumeTemplateData } from "./types";

export type ResumeAISelection = {
  /** Short professional title under the name (English resume). */
  headline?: string;
  /** 2-3 sentence summary (English resume). */
  summary?: string;
  /** `role`: the title translated by the model (English resume); the profile's own title is used when absent. */
  experiences: Array<{ company: string; bullets: string[]; role?: string }>;
  skills: Array<{ category: string; items: string }>;
  projects: Array<{ name: string; reason?: string }>;
  /** Degree/field translated by the model (English resume), matched by institution. */
  education?: Array<{ institution: string; degree?: string; field?: string }>;
};

export type BuildResumeOptions = {
  /** `pt` (default) keeps the original Brazilian flow untouched; `en` localizes labels and drops pt-only fixed text. */
  language?: ResumeLanguage;
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

function findBulletsForCompany(company: string, bulletsByCompany: Map<string, string[]>): string[] {
  const key = company.toLowerCase();
  if (bulletsByCompany.has(key)) return bulletsByCompany.get(key)!;
  // Fuzzy: one name contains the other
  for (const [k, v] of bulletsByCompany) {
    if (k.includes(key) || key.includes(k)) return v;
  }
  return [];
}

function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function selectProjects(
  projects: ProfileSnapshot["projects"],
  selection: ResumeAISelection["projects"],
): ProfileSnapshot["projects"] {
  if (selection.length === 0) {
    return [];
  }

  const selectedByKey = new Set(selection.map((project) => normalizeLookupKey(project.name)));

  return projects.filter((project) => {
    const projectKey = normalizeLookupKey(project.name);

    if (selectedByKey.has(projectKey)) {
      return true;
    }

    for (const selectedKey of selectedByKey) {
      if (projectKey.includes(selectedKey) || selectedKey.includes(projectKey)) {
        return true;
      }
    }

    return false;
  });
}

export function buildResumeData(
  profile: ProfileSnapshot,
  aiSelection: ResumeAISelection,
  options: BuildResumeOptions = {},
): ResumeTemplateData {
  const language = options.language ?? "pt";
  const isEnglish = language === "en";
  const bulletsByCompany = new Map<string, string[]>();
  const rolesByCompany = new Map<string, string>();
  for (const exp of aiSelection.experiences) {
    bulletsByCompany.set(exp.company.toLowerCase(), exp.bullets);
    if (isEnglish && exp.role?.trim()) {
      rolesByCompany.set(exp.company.toLowerCase(), exp.role.trim());
    }
  }

  return {
    language,
    headline: isEnglish ? aiSelection.headline?.trim() || undefined : undefined,
    summary: isEnglish ? aiSelection.summary?.trim() || undefined : undefined,
    fullName: profile.fullName,
    email: profile.email ?? undefined,
    phone: profile.phone ?? undefined,
    linkedin: profile.linkedin ?? undefined,
    github: profile.github ?? undefined,
    location: profile.location ?? undefined,

    experiences: profile.experiences.map((exp) => {
      const aiBullets = findBulletsForCompany(exp.company, bulletsByCompany);
      return {
        company: exp.company,
        role: isEnglish ? (rolesByCompany.get(exp.company.toLowerCase()) ?? exp.role) : exp.role,
        startDate: formatDate(exp.startDate),
        endDate: exp.isCurrent ? (isEnglish ? "Present" : "Atual") : formatDate(exp.endDate),
        bullets: aiBullets.map((content) => ({ content })),
      };
    }),

    skills: aiSelection.skills,

    // The profile has no spoken-language data: the Portuguese resume keeps its fixed
    // lines (original behavior); the English one leaves the section out rather than
    // claiming a level nobody entered.
    languages: isEnglish
      ? undefined
      : [
          { name: "Português", level: "Nativo" },
          { name: "Inglês", level: "Avançado" },
        ],

    projects: selectProjects(profile.projects, aiSelection.projects).map((p) => ({
      name: p.name,
      url: p.url ?? undefined,
      stack: p.stack.length > 0 ? p.stack.join(", ") : undefined,
      description: p.description ?? undefined,
      impact: p.impact ?? undefined,
    })),

    education: profile.education.map((e) => {
      const translated = isEnglish
        ? aiSelection.education?.find(
            (item) => normalizeLookupKey(item.institution) === normalizeLookupKey(e.institution),
          )
        : undefined;

      return {
        institution: e.institution,
        degree: translated?.degree?.trim() || e.degree || undefined,
        field: translated?.field?.trim() || e.field || undefined,
        period:
          e.startDate && e.endDate
            ? `${formatDate(e.startDate)} — ${formatDate(e.endDate)}`
            : (e.endDate ?? undefined),
        // Fixed "Brasil" only in the original pt flow; the profile has no per-school country.
        location: isEnglish ? undefined : "Brasil",
      };
    }),
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
