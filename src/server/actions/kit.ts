"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { prepareApplicationKit } from "@/lib/apply/kit";
import { computeKitStatus, readKit, setKitAnswer, upsertKit } from "@/lib/apply/kit-store";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { updateApplicationStatus } from "@/server/actions/applications";

export type PrepareKitActionResult =
  | { ok: true; warnings: string[]; status: string }
  | { ok: false; error: "not-found" | "no-profile" | "no-description" | "failed"; message?: string };

const MAX_ANSWER_LENGTH = 8000;

function revalidateKit(applicationId: number) {
  revalidatePath(`/applications/${applicationId}/kit`);
  revalidatePath("/applications");
}

/** "Preparar candidatura": resume in English, cover letter, form fields and answers. Never submits. */
export async function prepareApplicationKitAction(applicationId: number): Promise<PrepareKitActionResult> {
  if (!Number.isInteger(applicationId)) {
    return { ok: false, error: "not-found" };
  }

  try {
    const result = await prepareApplicationKit(applicationId);

    if (!result.ok) {
      return result;
    }

    revalidateKit(applicationId);

    return { ok: true, warnings: result.warnings, status: result.kit.status };
  } catch (error) {
    return { ok: false, error: "failed", message: error instanceof Error ? error.message : "Erro desconhecido." };
  }
}

export async function updateKitAnswerAction(
  applicationId: number,
  fieldId: string,
  value: string,
): Promise<{ ok: boolean; status?: string }> {
  if (!Number.isInteger(applicationId) || typeof fieldId !== "string" || typeof value !== "string") {
    return { ok: false };
  }

  const kit = setKitAnswer(applicationId, fieldId, value.slice(0, MAX_ANSWER_LENGTH));

  if (!kit) {
    return { ok: false };
  }

  revalidateKit(applicationId);

  return { ok: true, status: kit.status };
}

export async function updateKitCoverLetterAction(
  applicationId: number,
  text: string,
): Promise<{ ok: boolean; status?: string }> {
  const kit = Number.isInteger(applicationId) && typeof text === "string" ? readKit(applicationId) : null;

  if (!kit) {
    return { ok: false };
  }

  const coverLetter = text.trim() ? text.trim().slice(0, MAX_ANSWER_LENGTH) : null;
  // Fields mapped to the cover letter follow the edited text.
  const answers = { ...kit.answers };

  for (const [id, answer] of Object.entries(answers)) {
    if (answer.key === "cover_letter" && answer.source !== "manual") {
      answers[id] = { ...answer, value: coverLetter };
    }
  }

  const updated = upsertKit(applicationId, {
    coverLetter,
    answers,
    status: computeKitStatus({ ...kit, coverLetter, answers }),
  });

  revalidateKit(applicationId);

  return { ok: true, status: updated.status };
}

/**
 * "Marquei como enviada": the user sent the application themselves. Moves the
 * application to `applied` (with `applied_at`) through the existing status flow
 * and freezes the kit as `submitted_by_user`. The app never submits anything.
 */
export async function markKitSubmittedAction(applicationId: number): Promise<{ ok: boolean }> {
  const kit = Number.isInteger(applicationId) ? readKit(applicationId) : null;

  if (!kit) {
    return { ok: false };
  }

  const application = db
    .select({ status: applications.status, appliedAt: applications.appliedAt })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!application) {
    return { ok: false };
  }

  if (application.status !== "applied") {
    await updateApplicationStatus(applicationId, "applied");
  } else if (!application.appliedAt) {
    // Created directly as "applied": the first status change never happened, so stamp the date here.
    db.update(applications).set({ appliedAt: new Date(), updatedAt: new Date() }).where(eq(applications.id, applicationId)).run();
  }

  upsertKit(applicationId, { status: "submitted_by_user" });
  revalidateKit(applicationId);

  return { ok: true };
}
