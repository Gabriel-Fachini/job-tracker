import "server-only";

import { desc } from "drizzle-orm";

import {
  SKILL_CATEGORY_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  WORK_MODEL_OPTIONS,
  type ProfileSnapshot,
} from "@/lib/profile/editor";
import { db } from "@/lib/db";

export async function getProfileSnapshot(): Promise<ProfileSnapshot | null> {
  const result = await db.query.profile.findFirst({
    orderBy: (table) => [desc(table.updatedAt)],
    with: {
      experiences: {
        orderBy: (table) => [desc(table.startDate)],
        with: {
          bullets: true,
        },
      },
      skills: true,
      projects: true,
      education: true,
    },
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    fullName: result.fullName,
    email: result.email,
    phone: result.phone,
    linkedin: result.linkedin,
    github: result.github,
    location: result.location,
    workModelPreference: normalizeEnumValue(
      result.workModelPreference,
      WORK_MODEL_OPTIONS.map((option) => option.value),
    ),
    companyTypePreference: result.companyTypePreference,
    valuesPreference: result.valuesPreference,
    notes: result.notes,
    masterResumePath: result.masterResumePath,
    updatedAt: result.updatedAt,
    experiences: result.experiences.map((experience) => ({
      company: experience.company,
      role: experience.role,
      startDate: experience.startDate,
      endDate: experience.endDate,
      isCurrent: experience.isCurrent,
      description: experience.description,
      bullets: experience.bullets.map((bullet) => ({
        content: bullet.content,
        tags: parseJsonStringArray(bullet.tags),
      })),
    })),
    skills: result.skills.map((skill) => ({
      name: skill.name,
      level: normalizeEnumValue(
        skill.level,
        SKILL_LEVEL_OPTIONS.map((option) => option.value),
      ),
      yearsExperience: skill.yearsExperience,
      category: normalizeEnumValue(
        skill.category,
        SKILL_CATEGORY_OPTIONS.map((option) => option.value),
      ),
    })),
    projects: result.projects.map((project) => ({
      name: project.name,
      description: project.description,
      stack: parseJsonStringArray(project.stack),
      url: project.url,
      impact: project.impact,
    })),
    education: result.education.map((education) => ({
      institution: education.institution,
      degree: education.degree,
      field: education.field,
      startDate: education.startDate,
      endDate: education.endDate,
    })),
  };
}

function parseJsonStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function normalizeEnumValue<const T extends string>(
  value: string | null,
  allowedValues: readonly T[],
): T | null {
  if (!value) {
    return null;
  }

  return allowedValues.includes(value as T) ? (value as T) : null;
}
