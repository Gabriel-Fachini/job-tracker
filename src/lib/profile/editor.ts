export const WORK_MODEL_OPTIONS = [
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
  { value: "onsite", label: "Presencial" },
] as const;

export const SKILL_LEVEL_OPTIONS = [
  { value: "beginner", label: "Iniciante" },
  { value: "intermediate", label: "Intermediário" },
  { value: "advanced", label: "Avançado" },
  { value: "expert", label: "Especialista" },
] as const;

export const SKILL_CATEGORY_OPTIONS = [
  { value: "language", label: "Linguagem" },
  { value: "framework", label: "Framework" },
  { value: "tool", label: "Ferramenta" },
  { value: "soft-skill", label: "Soft skill" },
] as const;

export type WorkModelValue = (typeof WORK_MODEL_OPTIONS)[number]["value"];
export type SkillLevelValue = (typeof SKILL_LEVEL_OPTIONS)[number]["value"];
export type SkillCategoryValue = (typeof SKILL_CATEGORY_OPTIONS)[number]["value"];

export type ProfileSnapshot = {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  location: string | null;
  workModelPreference: WorkModelValue | null;
  companyTypePreference: string | null;
  valuesPreference: string | null;
  notes: string | null;
  masterResumePath: string | null;
  updatedAt: Date;
  experiences: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean | null;
    description: string | null;
    bullets: Array<{
      content: string;
      tags: string[];
    }>;
  }>;
  skills: Array<{
    name: string;
    level: SkillLevelValue | null;
    yearsExperience: number | null;
    category: SkillCategoryValue | null;
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

export type ProfileReviewBullet = {
  clientId: string;
  content: string;
  tags: string[];
};

export type ProfileReviewExperience = {
  clientId: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  bullets: ProfileReviewBullet[];
};

export type ProfileReviewSkill = {
  clientId: string;
  name: string;
  level: SkillLevelValue | "";
  yearsExperience: string;
  category: SkillCategoryValue | "";
};

export type ProfileReviewProject = {
  clientId: string;
  name: string;
  description: string;
  stack: string;
  url: string;
  impact: string;
};

export type ProfileReviewEducation = {
  clientId: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
};

export type ProfileReviewData = {
  profileId: number | null;
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
  workModelPreference: WorkModelValue | "";
  companyTypePreference: string;
  valuesPreference: string;
  notes: string;
  masterResumePath: string | null;
  experiences: ProfileReviewExperience[];
  skills: ProfileReviewSkill[];
  projects: ProfileReviewProject[];
  education: ProfileReviewEducation[];
};

export function createProfileReviewData(
  snapshot: ProfileSnapshot,
): ProfileReviewData {
  return {
    profileId: snapshot.id,
    fullName: snapshot.fullName,
    email: snapshot.email ?? "",
    phone: snapshot.phone ?? "",
    linkedin: snapshot.linkedin ?? "",
    github: snapshot.github ?? "",
    location: snapshot.location ?? "",
    workModelPreference: snapshot.workModelPreference ?? "",
    companyTypePreference: snapshot.companyTypePreference ?? "",
    valuesPreference: snapshot.valuesPreference ?? "",
    notes: snapshot.notes ?? "",
    masterResumePath: snapshot.masterResumePath,
    experiences: snapshot.experiences.map((experience) => ({
      clientId: createClientId("experience"),
      company: experience.company,
      role: experience.role,
      startDate: experience.startDate,
      endDate: experience.endDate ?? "",
      isCurrent: Boolean(experience.isCurrent),
      description: experience.description ?? "",
      bullets:
        experience.bullets.length > 0
          ? experience.bullets.map((bullet) => ({
              clientId: createClientId("bullet"),
              content: bullet.content,
              tags: bullet.tags,
            }))
          : [createEmptyBullet()],
    })),
    skills: snapshot.skills.map((skill) => ({
      clientId: createClientId("skill"),
      name: skill.name,
      level: skill.level ?? "",
      yearsExperience:
        typeof skill.yearsExperience === "number"
          ? String(skill.yearsExperience)
          : "",
      category: skill.category ?? "",
    })),
    projects: snapshot.projects.map((project) => ({
      clientId: createClientId("project"),
      name: project.name,
      description: project.description ?? "",
      stack: project.stack.join(", "),
      url: project.url ?? "",
      impact: project.impact ?? "",
    })),
    education: snapshot.education.map((education) => ({
      clientId: createClientId("education"),
      institution: education.institution,
      degree: education.degree ?? "",
      field: education.field ?? "",
      startDate: education.startDate ?? "",
      endDate: education.endDate ?? "",
    })),
  };
}

export function createEmptyBullet(): ProfileReviewBullet {
  return {
    clientId: createClientId("bullet"),
    content: "",
    tags: [],
  };
}

export function createEmptyExperience(): ProfileReviewExperience {
  return {
    clientId: createClientId("experience"),
    company: "",
    role: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
    bullets: [createEmptyBullet()],
  };
}

export function createEmptySkill(): ProfileReviewSkill {
  return {
    clientId: createClientId("skill"),
    name: "",
    level: "",
    yearsExperience: "",
    category: "",
  };
}

export function createEmptyProject(): ProfileReviewProject {
  return {
    clientId: createClientId("project"),
    name: "",
    description: "",
    stack: "",
    url: "",
    impact: "",
  };
}

export function createEmptyEducation(): ProfileReviewEducation {
  return {
    clientId: createClientId("education"),
    institution: "",
    degree: "",
    field: "",
    startDate: "",
    endDate: "",
  };
}

function createClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
