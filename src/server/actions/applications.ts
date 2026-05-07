"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { createApplicationRecord } from "@/lib/applications/create-application-record";
import { syncCompanyStatusForApplication } from "@/lib/company-links";
import { db } from "@/lib/db";
import {
  applications,
  applicationStages,
  applicationStatusHistory,
  companies,
} from "@/lib/db/schema";
import {
  normalizeApplicationStatus,
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/applications";
import {
  isSeniority,
  isSourceName,
  isWorkModel,
  type Seniority,
  type SourceName,
  type WorkModel,
} from "@/lib/jobs";

type ApplicationFormFields = {
  companyId: string;
  title: string;
  description: string;
  sourceUrl: string;
  sourceName: string;
  workModel: string;
  seniority: string;
  status: string;
  notes: string;
};

export type ApplicationCreateResult =
  | { success: true; id: number }
  | { success: false; error: string };

type MutationResult =
  | { success: true }
  | { success: false; error: "not_found" | "validation" };

type ApplicationStageFields = {
  label: string;
  date: string;
  notes: string;
};

export async function createApplication(
  _prev: ApplicationCreateResult | null,
  formData: FormData,
): Promise<ApplicationCreateResult> {
  const fields = readFields(formData);

  if (!fields.title || !fields.description) {
    return { success: false, error: "validation" };
  }

  if (fields.sourceUrl) {
    try {
      new URL(fields.sourceUrl);
    } catch {
      return { success: false, error: "validation" };
    }
  }

  const companyId = Number(fields.companyId);

  if (!Number.isInteger(companyId)) {
    return { success: false, error: "validation" };
  }

  const selectedCompany = db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!selectedCompany) {
    return { success: false, error: "validation" };
  }

  const result = createApplicationRecord({
    companyId,
    title: fields.title,
    description: fields.description,
    sourceUrl: fields.sourceUrl || null,
    sourceName: normalizeSourceName(fields.sourceName),
    workModel: normalizeWorkModel(fields.workModel),
    seniority: normalizeSeniority(fields.seniority),
    status: normalizeStatus(fields.status),
    notes: fields.notes || null,
  });

  revalidatePath("/applications");
  revalidatePath("/companies");
  return { success: true, id: result.applicationId };
}

export async function updateApplicationStatus(
  applicationId: number,
  status: ApplicationStatus,
): Promise<{ success: boolean; error?: "not_found" | "validation" }> {
  if (!Number.isInteger(applicationId) || !isApplicationStatus(status)) {
    return { success: false, error: "validation" };
  }

  const current = db
    .select({
      id: applications.id,
      status: applications.status,
      appliedAt: applications.appliedAt,
    })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!current) {
    return { success: false, error: "not_found" };
  }

  if (current.status === status) {
    return { success: true };
  }

  const now = new Date();
  const updates: Partial<typeof applications.$inferInsert> & {
    status: ApplicationStatus;
    updatedAt: Date;
  } = {
    status,
    updatedAt: now,
  };

  if (status === "applied" && !current.appliedAt) {
    updates.appliedAt = now;
  }

  db.transaction((tx) => {
    tx.update(applications)
      .set(updates)
      .where(eq(applications.id, applicationId))
      .run();

    tx.insert(applicationStatusHistory)
      .values({
        applicationId,
        fromStatus: current.status,
        toStatus: status,
        changedAt: now,
      })
      .run();
  });

  syncCompanyStatusForApplication(applicationId);

  revalidatePath("/applications");
  revalidatePath("/companies");

  return { success: true };
}

export async function createApplicationStage(
  applicationId: number,
  formData: FormData,
): Promise<MutationResult> {
  if (!Number.isInteger(applicationId)) {
    return { success: false, error: "validation" };
  }

  const current = db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!current) {
    return { success: false, error: "not_found" };
  }

  const fields = readApplicationStageFields(formData);
  const stageDate = parseStageDate(fields.date);

  if (!fields.label || !stageDate) {
    return { success: false, error: "validation" };
  }

  const now = new Date();

  db.transaction((tx) => {
    tx.insert(applicationStages)
      .values({
        applicationId,
        label: fields.label,
        date: stageDate,
        notes: fields.notes || null,
        createdAt: now,
      })
      .run();

    tx.update(applications)
      .set({ updatedAt: now })
      .where(eq(applications.id, applicationId))
      .run();
  });

  revalidatePath("/applications");

  return { success: true };
}

export async function updateApplicationStage(
  stageId: number,
  formData: FormData,
): Promise<MutationResult> {
  if (!Number.isInteger(stageId)) {
    return { success: false, error: "validation" };
  }

  const current = db
    .select({
      id: applicationStages.id,
      applicationId: applicationStages.applicationId,
    })
    .from(applicationStages)
    .where(eq(applicationStages.id, stageId))
    .get();

  if (!current) {
    return { success: false, error: "not_found" };
  }

  const fields = readApplicationStageFields(formData);
  const stageDate = parseStageDate(fields.date);

  if (!fields.label || !stageDate) {
    return { success: false, error: "validation" };
  }

  const now = new Date();

  db.transaction((tx) => {
    tx.update(applicationStages)
      .set({
        label: fields.label,
        date: stageDate,
        notes: fields.notes || null,
      })
      .where(eq(applicationStages.id, stageId))
      .run();

    tx.update(applications)
      .set({ updatedAt: now })
      .where(eq(applications.id, current.applicationId))
      .run();
  });

  revalidatePath("/applications");

  return { success: true };
}

export async function deleteApplicationStage(
  stageId: number,
): Promise<MutationResult> {
  if (!Number.isInteger(stageId)) {
    return { success: false, error: "validation" };
  }

  const current = db
    .select({
      id: applicationStages.id,
      applicationId: applicationStages.applicationId,
    })
    .from(applicationStages)
    .where(eq(applicationStages.id, stageId))
    .get();

  if (!current) {
    return { success: false, error: "not_found" };
  }

  const now = new Date();

  db.transaction((tx) => {
    tx.delete(applicationStages)
      .where(eq(applicationStages.id, stageId))
      .run();

    tx.update(applications)
      .set({ updatedAt: now })
      .where(eq(applications.id, current.applicationId))
      .run();
  });

  revalidatePath("/applications");

  return { success: true };
}

export async function updateApplicationNotes(
  applicationId: number,
  notes: string,
): Promise<MutationResult> {
  if (!Number.isInteger(applicationId)) {
    return { success: false, error: "validation" };
  }

  const current = db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!current) {
    return { success: false, error: "not_found" };
  }

  db.update(applications)
    .set({
      notes: notes.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId))
    .run();

  revalidatePath("/applications");

  return { success: true };
}

function readFields(formData: FormData): ApplicationFormFields {
  return {
    companyId: String(formData.get("companyId") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim(),
    sourceName: String(formData.get("sourceName") ?? "").trim(),
    workModel: String(formData.get("workModel") ?? "").trim(),
    seniority: String(formData.get("seniority") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function readApplicationStageFields(formData: FormData): ApplicationStageFields {
  return {
    label: String(formData.get("label") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function normalizeStatus(value: string): ApplicationStatus {
  return normalizeApplicationStatus(value);
}

function normalizeWorkModel(value: string): WorkModel | null {
  return isWorkModel(value) ? value : null;
}

function normalizeSeniority(value: string): Seniority | null {
  return isSeniority(value) ? value : null;
}

function normalizeSourceName(value: string): SourceName | null {
  return isSourceName(value) ? value : null;
}

function parseStageDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}
