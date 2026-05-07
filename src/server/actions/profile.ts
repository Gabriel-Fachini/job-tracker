"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, inArray } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { type ExtractedProfile } from "@/lib/ai/ollama";
import { extractProfileWithOpenAi } from "@/lib/ai/openai";
import { db } from "@/lib/db";
import {
  profile,
  profileEducation,
  profileExperienceBullets,
  profileExperiences,
  profileProjects,
  profileSkills,
} from "@/lib/db/schema";
import type { ProfileReviewData } from "@/lib/profile/editor";

type ExtractProfileInput = {
  rawText: string;
  masterResumePath: string;
};

type SaveExtractedProfileInput = {
  extractedProfile: ExtractedProfile;
  masterResumePath: string;
};

type PersistedProfilePayload = {
  profile: ExtractedProfile["profile"] & {
    companyTypePreference?: string | null;
    valuesPreference?: string | null;
  };
  experiences: ExtractedProfile["experiences"];
  skills: ExtractedProfile["skills"];
  projects: ExtractedProfile["projects"];
  education: ExtractedProfile["education"];
};

export type ExtractProfileDraftActionResult =
  | {
      ok: true;
      extractedProfile: ExtractedProfile;
      summary: {
        experiences: number;
        skills: number;
        projects: number;
        education: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

export type ExtractProfileActionResult =
  | {
      ok: true;
      profileId: number;
      summary: {
        experiences: number;
        skills: number;
        projects: number;
        education: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

export type UpdateProfileActionResult =
  | {
      ok: true;
      savedAt: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function extractProfile(
  input: ExtractProfileInput,
): Promise<ExtractProfileActionResult> {
  const extraction = await extractProfileDraft(input);

  if (!extraction.ok) {
    return extraction;
  }

  return saveExtractedProfile({
    extractedProfile: extraction.extractedProfile,
    masterResumePath: input.masterResumePath,
  });
}

export async function extractProfileDraft(
  input: ExtractProfileInput,
): Promise<ExtractProfileDraftActionResult> {
  const rawText = input.rawText.trim();

  if (!rawText) {
    return {
      ok: false,
      error: "O currículo enviado não gerou texto para extração.",
    };
  }

  if (!input.masterResumePath.trim()) {
    return {
      ok: false,
      error: "O caminho do currículo enviado está ausente.",
    };
  }

  try {
    const extractedProfile = await extractProfileWithOpenAi(rawText);

    return {
      ok: true,
      extractedProfile,
      summary: {
        experiences: extractedProfile.experiences.length,
        skills: extractedProfile.skills.length,
        projects: extractedProfile.projects.length,
        education: extractedProfile.education.length,
      },
    };
  } catch (error) {
    await logProfileExtractionFailure(rawText, error);

    if (error instanceof Error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return {
      ok: false,
      error: "A extração do perfil falhou por um motivo desconhecido.",
    };
  }
}

export async function saveExtractedProfile(
  input: SaveExtractedProfileInput,
): Promise<ExtractProfileActionResult> {
  const masterResumePath = input.masterResumePath.trim();

  if (!masterResumePath) {
    return {
      ok: false,
      error: "O caminho do currículo enviado está ausente.",
    };
  }

  try {
    const extractedProfile = {
      profile: {
        ...input.extractedProfile.profile,
        masterResumePath,
      },
      experiences: input.extractedProfile.experiences,
      skills: input.extractedProfile.skills,
      projects: input.extractedProfile.projects,
      education: input.extractedProfile.education,
    } satisfies PersistedProfilePayload;

    const profileId = persistProfilePayload(extractedProfile, {
      preserveExistingPreferences: true,
    });

    revalidatePath("/profile");

    return {
      ok: true,
      profileId,
      summary: {
        experiences: extractedProfile.experiences.length,
        skills: extractedProfile.skills.length,
        projects: extractedProfile.projects.length,
        education: extractedProfile.education.length,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return {
      ok: false,
      error: "Falha ao salvar o perfil no banco de dados.",
    };
  }
}

export async function updateProfile(
  data: ProfileReviewData,
): Promise<UpdateProfileActionResult> {
  try {
    const normalizedProfile = normalizeProfileReviewData(data);

    persistProfilePayload(normalizedProfile, {
      requestedProfileId: data.profileId,
      preserveExistingPreferences: false,
    });

    revalidatePath("/profile");

    return {
      ok: true,
      savedAt: Date.now(),
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return {
      ok: false,
      error: "Falha ao atualizar o perfil.",
    };
  }
}

async function logProfileExtractionFailure(rawText: string, error: unknown) {
  try {
    const logDirectory = path.join(process.cwd(), "tmp", "logs");
    await mkdir(logDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await writeFile(
      path.join(logDirectory, `profile-extraction-error-${timestamp}.json`),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          error: errorMessage,
          inputPreview: rawText.slice(0, 20_000),
        },
        null,
        2,
      ),
    );
  } catch (logError) {
    console.warn("Falha ao gravar log de erro da extração de perfil.", logError);
  }
}

function normalizeProfileReviewData(
  data: ProfileReviewData,
): PersistedProfilePayload {
  const fullName = getRequiredText(data.fullName, "Nome completo");

  return {
    profile: {
      fullName,
      email: getOptionalText(data.email),
      phone: getOptionalText(data.phone),
      linkedin: getOptionalText(data.linkedin),
      github: getOptionalText(data.github),
      location: getOptionalText(data.location),
      workModelPreference: data.workModelPreference || null,
      companyTypePreference: getOptionalText(data.companyTypePreference),
      valuesPreference: getOptionalText(data.valuesPreference),
      notes: getOptionalText(data.notes),
      masterResumePath: getOptionalText(data.masterResumePath),
    },
    experiences: normalizeExperiences(data.experiences),
    skills: normalizeSkills(data.skills),
    projects: normalizeProjects(data.projects),
    education: normalizeEducation(data.education),
  };
}

function normalizeExperiences(
  experiences: ProfileReviewData["experiences"],
): ExtractedProfile["experiences"] {
  ensureArray(experiences, "experiências");

  return experiences.flatMap((experience) => {
    const company = getOptionalText(experience.company);
    const role = getOptionalText(experience.role);
    const startDate = getOptionalText(experience.startDate);
    const endDate = getOptionalText(experience.endDate);
    const description = getOptionalText(experience.description);
    const bullets = normalizeBullets(experience.bullets);

    const isBlankExperience =
      !company &&
      !role &&
      !startDate &&
      !endDate &&
      !description &&
      bullets.length === 0;

    if (isBlankExperience) {
      return [];
    }

    if (!company) {
      throw new Error("Cada experiência precisa informar a empresa.");
    }

    if (!role) {
      throw new Error("Cada experiência precisa informar o cargo.");
    }

    if (!startDate) {
      throw new Error("Cada experiência precisa informar a data de início.");
    }

    return [
      {
        company,
        role,
        startDate,
        endDate: experience.isCurrent ? null : endDate,
        isCurrent: experience.isCurrent,
        description,
        bullets,
      },
    ];
  });
}

function normalizeBullets(
  bullets: ProfileReviewData["experiences"][number]["bullets"],
): ExtractedProfile["experiences"][number]["bullets"] {
  ensureArray(bullets, "bullets");

  return bullets.flatMap((bullet) => {
    const content = getOptionalText(bullet.content);

    if (!content) {
      return [];
    }

    return [
      {
        content,
        tags: Array.isArray(bullet.tags)
          ? bullet.tags
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0)
          : [],
      },
    ];
  });
}

function normalizeSkills(
  skills: ProfileReviewData["skills"],
): ExtractedProfile["skills"] {
  ensureArray(skills, "habilidades");

  return skills.flatMap((skill) => {
    const name = getOptionalText(skill.name);
    const level = skill.level || null;
    const category = skill.category || null;
    const yearsExperience = parseOptionalNonNegativeInteger(
      skill.yearsExperience,
      "anos de experiência",
    );

    if (!name && !level && !category && yearsExperience == null) {
      return [];
    }

    if (!name) {
      throw new Error("Cada habilidade precisa informar o nome.");
    }

    return [
      {
        name,
        level,
        yearsExperience,
        category,
      },
    ];
  });
}

function normalizeProjects(
  projects: ProfileReviewData["projects"],
): ExtractedProfile["projects"] {
  ensureArray(projects, "projetos");

  return projects.flatMap((project) => {
    const name = getOptionalText(project.name);
    const description = getOptionalText(project.description);
    const stack = splitCommaSeparatedList(project.stack);
    const url = getOptionalText(project.url);
    const impact = getOptionalText(project.impact);

    if (!name && !description && stack.length === 0 && !url && !impact) {
      return [];
    }

    if (!name) {
      throw new Error("Cada projeto precisa informar o nome.");
    }

    return [
      {
        name,
        description,
        stack,
        url,
        impact,
      },
    ];
  });
}

function normalizeEducation(
  educationList: ProfileReviewData["education"],
): ExtractedProfile["education"] {
  ensureArray(educationList, "formação");

  return educationList.flatMap((education) => {
    const institution = getOptionalText(education.institution);
    const degree = getOptionalText(education.degree);
    const field = getOptionalText(education.field);
    const startDate = getOptionalText(education.startDate);
    const endDate = getOptionalText(education.endDate);

    if (!institution && !degree && !field && !startDate && !endDate) {
      return [];
    }

    if (!institution) {
      throw new Error("Cada formação precisa informar a instituição.");
    }

    return [
      {
        institution,
        degree,
        field,
        startDate,
        endDate,
      },
    ];
  });
}

function persistProfilePayload(
  payload: PersistedProfilePayload,
  options?: {
    requestedProfileId?: number | null;
    preserveExistingPreferences?: boolean;
  },
) {
  return db.transaction((tx) => {
    const now = new Date();
    const existingProfile = getExistingProfileForWrite(
      tx,
      options?.requestedProfileId ?? null,
    );

    if (existingProfile) {
      clearProfileChildren(tx, existingProfile.id);

      tx
        .update(profile)
        .set({
          fullName: payload.profile.fullName,
          email: payload.profile.email,
          phone: payload.profile.phone,
          linkedin: payload.profile.linkedin,
          github: payload.profile.github,
          location: payload.profile.location,
          workModelPreference: payload.profile.workModelPreference,
          companyTypePreference: resolvePreferenceValue({
            incoming: payload.profile.companyTypePreference,
            existing: existingProfile.companyTypePreference,
            preserveExisting:
              options?.preserveExistingPreferences === true,
          }),
          valuesPreference: resolvePreferenceValue({
            incoming: payload.profile.valuesPreference,
            existing: existingProfile.valuesPreference,
            preserveExisting:
              options?.preserveExistingPreferences === true,
          }),
          notes: payload.profile.notes,
          masterResumePath: payload.profile.masterResumePath,
          updatedAt: now,
        })
        .where(eq(profile.id, existingProfile.id))
        .run();

      insertProfileChildren(tx, existingProfile.id, payload, now);

      return existingProfile.id;
    }

    const createdProfile = tx
      .insert(profile)
      .values({
        fullName: payload.profile.fullName,
        email: payload.profile.email,
        phone: payload.profile.phone,
        linkedin: payload.profile.linkedin,
        github: payload.profile.github,
        location: payload.profile.location,
        workModelPreference: payload.profile.workModelPreference,
        companyTypePreference: payload.profile.companyTypePreference ?? null,
        valuesPreference: payload.profile.valuesPreference ?? null,
        notes: payload.profile.notes,
        masterResumePath: payload.profile.masterResumePath,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: profile.id })
      .get();

    if (!createdProfile) {
      throw new Error("Falha ao persistir o perfil.");
    }

    insertProfileChildren(tx, createdProfile.id, payload, now);

    return createdProfile.id;
  });
}

function getExistingProfileForWrite(tx: typeof db, requestedProfileId: number | null) {
  if (requestedProfileId) {
    const selectedProfile = tx
      .select({
        id: profile.id,
        companyTypePreference: profile.companyTypePreference,
        valuesPreference: profile.valuesPreference,
      })
      .from(profile)
      .where(eq(profile.id, requestedProfileId))
      .limit(1)
      .get();

    if (selectedProfile) {
      return selectedProfile;
    }
  }

  return tx
    .select({
      id: profile.id,
      companyTypePreference: profile.companyTypePreference,
      valuesPreference: profile.valuesPreference,
    })
    .from(profile)
    .orderBy(desc(profile.updatedAt))
    .limit(1)
    .get();
}

function clearProfileChildren(tx: typeof db, profileId: number) {
  const existingExperiences = tx
    .select({ id: profileExperiences.id })
    .from(profileExperiences)
    .where(eq(profileExperiences.profileId, profileId))
    .all();

  const experienceIds = existingExperiences.map((item) => item.id);

  if (experienceIds.length > 0) {
    tx
      .delete(profileExperienceBullets)
      .where(inArray(profileExperienceBullets.experienceId, experienceIds))
      .run();
  }

  tx
    .delete(profileExperiences)
    .where(eq(profileExperiences.profileId, profileId))
    .run();
  tx.delete(profileSkills).where(eq(profileSkills.profileId, profileId)).run();
  tx.delete(profileProjects).where(eq(profileProjects.profileId, profileId)).run();
  tx.delete(profileEducation).where(eq(profileEducation.profileId, profileId)).run();
}

function insertProfileChildren(
  tx: typeof db,
  profileId: number,
  payload: PersistedProfilePayload,
  createdAt: Date,
) {
  for (const experience of payload.experiences) {
    const insertedExperience = tx
      .insert(profileExperiences)
      .values({
        profileId,
        company: experience.company,
        role: experience.role,
        startDate: experience.startDate,
        endDate: experience.endDate,
        isCurrent: experience.isCurrent,
        description: experience.description,
        createdAt,
      })
      .returning({ id: profileExperiences.id })
      .get();

    const experienceId = insertedExperience?.id;

    if (!experienceId) {
      throw new Error("Falha ao persistir uma das experiências do perfil.");
    }

    if (experience.bullets.length > 0) {
      tx.insert(profileExperienceBullets).values(
        experience.bullets.map((bullet) => ({
          experienceId,
          content: bullet.content,
          tags: JSON.stringify(bullet.tags),
          createdAt,
        })),
      ).run();
    }
  }

  if (payload.skills.length > 0) {
    tx.insert(profileSkills).values(
      payload.skills.map((skill) => ({
        profileId,
        name: skill.name,
        level: skill.level,
        yearsExperience: skill.yearsExperience,
        category: skill.category,
      })),
    ).run();
  }

  if (payload.projects.length > 0) {
    tx.insert(profileProjects).values(
      payload.projects.map((project) => ({
        profileId,
        name: project.name,
        description: project.description,
        stack: JSON.stringify(project.stack),
        url: project.url,
        impact: project.impact,
        createdAt,
      })),
    ).run();
  }

  if (payload.education.length > 0) {
    tx.insert(profileEducation).values(
      payload.education.map((educationItem) => ({
        profileId,
        institution: educationItem.institution,
        degree: educationItem.degree,
        field: educationItem.field,
        startDate: educationItem.startDate,
        endDate: educationItem.endDate,
      })),
    ).run();
  }
}

function resolvePreferenceValue({
  incoming,
  existing,
  preserveExisting,
}: {
  incoming: string | null | undefined;
  existing: string | null;
  preserveExisting: boolean;
}) {
  if (incoming !== undefined) {
    return incoming;
  }

  return preserveExisting ? existing : null;
}

function splitCommaSeparatedList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseOptionalNonNegativeInteger(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`O campo ${label} precisa ser um número inteiro maior ou igual a zero.`);
  }

  return parsed;
}

function getRequiredText(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} é obrigatório.`);
  }

  return normalized;
}

function getOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function ensureArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Os dados de ${label} chegaram em um formato inválido.`);
  }
}
