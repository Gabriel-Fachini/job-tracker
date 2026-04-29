"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, inArray } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { extractProfileFromText, type ExtractedProfile } from "@/lib/ai/ollama";
import { db } from "@/lib/db";
import {
  profile,
  profileEducation,
  profileExperienceBullets,
  profileExperiences,
  profileProjects,
  profileSkills,
} from "@/lib/db/schema";

type ExtractProfileInput = {
  rawText: string;
  masterResumePath: string;
};

type SaveExtractedProfileInput = {
  extractedProfile: ExtractedProfile;
  masterResumePath: string;
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
    const extractedProfile = await extractProfileFromText(rawText);

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
      ...input.extractedProfile,
      profile: {
        ...input.extractedProfile.profile,
        masterResumePath,
      },
    };

    const profileId = persistExtractedProfile(extractedProfile);

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

function persistExtractedProfile(extractedProfile: ExtractedProfile) {
  return db.transaction((tx) => {
    const now = new Date();
    const existingProfile = tx
      .select({
        id: profile.id,
        createdAt: profile.createdAt,
      })
      .from(profile)
      .orderBy(desc(profile.updatedAt))
      .limit(1)
      .get();

    if (existingProfile) {
      const existingExperiences = tx
        .select({ id: profileExperiences.id })
        .from(profileExperiences)
        .where(eq(profileExperiences.profileId, existingProfile.id))
        .all();

      const experienceIds = existingExperiences.map((item) => item.id);

      if (experienceIds.length > 0) {
        tx
          .delete(profileExperienceBullets)
          .where(inArray(profileExperienceBullets.experienceId, experienceIds));
      }

      tx
        .delete(profileExperiences)
        .where(eq(profileExperiences.profileId, existingProfile.id));
      tx
        .delete(profileSkills)
        .where(eq(profileSkills.profileId, existingProfile.id));
      tx
        .delete(profileProjects)
        .where(eq(profileProjects.profileId, existingProfile.id));
      tx
        .delete(profileEducation)
        .where(eq(profileEducation.profileId, existingProfile.id));

      tx
        .update(profile)
        .set({
          fullName: extractedProfile.profile.fullName,
          email: extractedProfile.profile.email,
          phone: extractedProfile.profile.phone,
          linkedin: extractedProfile.profile.linkedin,
          github: extractedProfile.profile.github,
          location: extractedProfile.profile.location,
          workModelPreference: extractedProfile.profile.workModelPreference,
          notes: extractedProfile.profile.notes,
          masterResumePath: extractedProfile.profile.masterResumePath,
          updatedAt: now,
        })
        .where(eq(profile.id, existingProfile.id));

      insertProfileChildren(tx, existingProfile.id, extractedProfile, now);

      return existingProfile.id;
    }

    const createdProfile = tx
      .insert(profile)
      .values({
        fullName: extractedProfile.profile.fullName,
        email: extractedProfile.profile.email,
        phone: extractedProfile.profile.phone,
        linkedin: extractedProfile.profile.linkedin,
        github: extractedProfile.profile.github,
        location: extractedProfile.profile.location,
        workModelPreference: extractedProfile.profile.workModelPreference,
        notes: extractedProfile.profile.notes,
        masterResumePath: extractedProfile.profile.masterResumePath,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: profile.id })
      .get();

    if (!createdProfile) {
      throw new Error("Falha ao persistir o perfil extraído.");
    }

    insertProfileChildren(tx, createdProfile.id, extractedProfile, now);

    return createdProfile.id;
  });
}

function insertProfileChildren(
  tx: typeof db,
  profileId: number,
  extractedProfile: ExtractedProfile,
  createdAt: Date,
) {
  for (const experience of extractedProfile.experiences) {
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
      throw new Error("Falha ao persistir uma das experiências extraídas.");
    }

    if (experience.bullets.length > 0) {
      tx.insert(profileExperienceBullets).values(
        experience.bullets.map((bullet) => ({
          experienceId,
          content: bullet.content,
          tags: JSON.stringify(bullet.tags),
          createdAt,
        })),
      );
    }
  }

  if (extractedProfile.skills.length > 0) {
    tx.insert(profileSkills).values(
      extractedProfile.skills.map((skill) => ({
        profileId,
        name: skill.name,
        level: skill.level,
        yearsExperience: skill.yearsExperience,
        category: skill.category,
      })),
    );
  }

  if (extractedProfile.projects.length > 0) {
    tx.insert(profileProjects).values(
      extractedProfile.projects.map((project) => ({
        profileId,
        name: project.name,
        description: project.description,
        stack: JSON.stringify(project.stack),
        url: project.url,
        impact: project.impact,
        createdAt,
      })),
    );
  }

  if (extractedProfile.education.length > 0) {
    tx.insert(profileEducation).values(
      extractedProfile.education.map((educationItem) => ({
        profileId,
        institution: educationItem.institution,
        degree: educationItem.degree,
        field: educationItem.field,
        startDate: educationItem.startDate,
        endDate: educationItem.endDate,
      })),
    );
  }
}
