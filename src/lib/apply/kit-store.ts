import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicationKits } from "@/lib/db/schema";

import { isFieldKey, kitStatusValues, type FormField, type KitAnswer, type KitAnswers, type KitStatus } from "./types";

export type KitView = {
  id: number;
  applicationId: number;
  language: string;
  applyUrl: string | null;
  resumePath: string | null;
  coverLetter: string | null;
  fields: FormField[];
  answers: KitAnswers;
  status: KitStatus;
  createdAt: Date;
  updatedAt: Date;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toView(row: typeof applicationKits.$inferSelect): KitView {
  const answers = parseJson<KitAnswers>(row.answers, {});

  // Stored JSON is data, not trusted shape: drop answers whose key is not a known one.
  for (const [id, answer] of Object.entries(answers)) {
    if (!answer || typeof answer !== "object" || !isFieldKey(answer.key)) {
      delete answers[id];
    }
  }

  return {
    id: row.id,
    applicationId: row.applicationId,
    language: row.language,
    applyUrl: row.applyUrl,
    resumePath: row.resumePath,
    coverLetter: row.coverLetter,
    fields: parseJson<FormField[]>(row.formFields, []),
    answers,
    status: (kitStatusValues as readonly string[]).includes(row.status) ? (row.status as KitStatus) : "draft",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * `ready` = English resume, cover letter and every required (non-demographic)
 * field answered. `submitted_by_user` is only ever set by the user and sticks.
 */
export function computeKitStatus(
  kit: Pick<KitView, "resumePath" | "coverLetter" | "fields" | "answers"> & { status?: KitStatus },
): KitStatus {
  if (kit.status === "submitted_by_user") {
    return "submitted_by_user";
  }

  const missingRequired = kit.fields.filter(
    (field) => field.required && !field.eeo && kit.answers[field.id]?.key !== "eeo_demographic" && !kit.answers[field.id]?.value,
  );

  return kit.resumePath && kit.coverLetter && kit.fields.length > 0 && missingRequired.length === 0 ? "ready" : "draft";
}

export function readKit(applicationId: number): KitView | null {
  const row = db.select().from(applicationKits).where(eq(applicationKits.applicationId, applicationId)).get();

  return row ? toView(row) : null;
}

export type KitUpsert = {
  applyUrl?: string | null;
  resumePath?: string | null;
  coverLetter?: string | null;
  fields?: FormField[];
  answers?: KitAnswers;
  status?: KitStatus;
  language?: string;
};

/** Inserts the kit or updates only the given parts (a re-prepare keeps the rest). */
export function upsertKit(applicationId: number, data: KitUpsert): KitView {
  const now = new Date();
  const values = {
    ...(data.applyUrl !== undefined ? { applyUrl: data.applyUrl } : {}),
    ...(data.resumePath !== undefined ? { resumePath: data.resumePath } : {}),
    ...(data.coverLetter !== undefined ? { coverLetter: data.coverLetter } : {}),
    ...(data.fields !== undefined ? { formFields: JSON.stringify(data.fields) } : {}),
    ...(data.answers !== undefined ? { answers: JSON.stringify(data.answers) } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.language !== undefined ? { language: data.language } : {}),
    updatedAt: now,
  };
  const existing = db.select({ id: applicationKits.id }).from(applicationKits).where(eq(applicationKits.applicationId, applicationId)).get();

  if (existing) {
    db.update(applicationKits).set(values).where(eq(applicationKits.id, existing.id)).run();
  } else {
    db.insert(applicationKits).values({ applicationId, createdAt: now, ...values }).run();
  }

  return readKit(applicationId) as KitView;
}

/** A manual edit: the answer becomes the user's own (not a draft anymore). */
export function setKitAnswer(applicationId: number, fieldId: string, value: string | null): KitView | null {
  const kit = readKit(applicationId);

  if (!kit || !kit.fields.some((field) => field.id === fieldId)) {
    return null;
  }

  const current: KitAnswer = kit.answers[fieldId] ?? { key: "unknown", value: null, source: "none" };
  const trimmed = value?.trim() ? value.trim() : null;

  const answers = {
    ...kit.answers,
    [fieldId]: { ...current, value: trimmed, source: trimmed ? ("manual" as const) : ("none" as const), aiDraft: false, note: undefined },
  };

  return upsertKit(applicationId, { answers, status: computeKitStatus({ ...kit, answers }) });
}
