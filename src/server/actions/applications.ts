"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { applications, jobs } from "@/lib/db/schema";
import {
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
  company: string;
  title: string;
  description: string;
  sourceUrl: string;
  sourceName: string;
  workModel: string;
  seniority: string;
  status: string;
  notes: string;
};

type CreateResult =
  | { success: true; id: number }
  | { success: false; error: string };

export async function createApplication(
  _prev: CreateResult | null,
  formData: FormData,
): Promise<CreateResult> {
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

  const now = new Date();

  const jobResult = db
    .insert(jobs)
    .values({
      company: fields.company || null,
      title: fields.title,
      description: fields.description,
      sourceUrl: fields.sourceUrl || null,
      sourceName: normalizeSourceName(fields.sourceName),
      status: "interesting",
      workModel: normalizeWorkModel(fields.workModel),
      seniority: normalizeSeniority(fields.seniority),
      createdAt: now,
    })
    .returning({ id: jobs.id })
    .get();

  const appResult = db
    .insert(applications)
    .values({
      jobId: jobResult.id,
      status: normalizeStatus(fields.status),
      notes: fields.notes || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: applications.id })
    .get();

  revalidatePath("/applications");
  return { success: true, id: appResult.id };
}

export async function updateApplicationStatus(
  applicationId: number,
  status: ApplicationStatus,
): Promise<void> {
  db.update(applications)
    .set({ status, updatedAt: new Date() })
    .where(eq(applications.id, applicationId))
    .run();

  revalidatePath("/applications");
}

function readFields(formData: FormData): ApplicationFormFields {
  return {
    company: String(formData.get("company") ?? "").trim(),
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

function normalizeStatus(value: string): ApplicationStatus {
  return isApplicationStatus(value) ? value : "interesting";
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
