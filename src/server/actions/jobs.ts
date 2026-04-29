"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import {
  isJobStatus,
  isSeniority,
  isSourceName,
  isWorkModel,
  type JobStatus,
  type Seniority,
  type SourceName,
  type WorkModel,
} from "@/lib/jobs";

type JobFields = {
  company: string;
  title: string;
  description: string;
  sourceUrl: string;
  sourceName: string;
  status: string;
  workModel: string;
  seniority: string;
};

export async function createJob(formData: FormData): Promise<void> {
  const fields = readFields(formData);

  if (!isValid(fields)) {
    redirect("/jobs/new?error=validation");
  }

  const now = new Date();

  db.insert(jobs)
    .values({
      company: fields.company || null,
      title: fields.title,
      description: fields.description,
      sourceUrl: fields.sourceUrl || null,
      sourceName: normalizeSourceName(fields.sourceName),
      status: normalizeStatus(fields.status),
      workModel: normalizeWorkModel(fields.workModel),
      seniority: normalizeSeniority(fields.seniority),
      createdAt: now,
    })
    .run();

  revalidatePath("/jobs");
  redirect("/jobs");
}

export async function updateJob(jobId: number, formData: FormData): Promise<void> {
  const existingJob = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get();

  if (!existingJob) {
    notFound();
  }

  const fields = readFields(formData);

  if (!isValid(fields)) {
    redirect(`/jobs/${jobId}?mode=edit&error=validation`);
  }

  db.update(jobs)
    .set({
      company: fields.company || null,
      title: fields.title,
      description: fields.description,
      sourceUrl: fields.sourceUrl || null,
      sourceName: normalizeSourceName(fields.sourceName),
      status: normalizeStatus(fields.status),
      workModel: normalizeWorkModel(fields.workModel),
      seniority: normalizeSeniority(fields.seniority),
    })
    .where(eq(jobs.id, jobId))
    .run();

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}

function readFields(formData: FormData): JobFields {
  return {
    company: String(formData.get("company") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim(),
    sourceName: String(formData.get("sourceName") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    workModel: String(formData.get("workModel") ?? "").trim(),
    seniority: String(formData.get("seniority") ?? "").trim(),
  };
}

function isValid(fields: JobFields) {
  if (!fields.title || !fields.description) {
    return false;
  }

  if (fields.sourceUrl) {
    try {
      new URL(fields.sourceUrl);
    } catch {
      return false;
    }
  }

  if (fields.status && !isJobStatus(fields.status)) {
    return false;
  }

  if (fields.workModel && !isWorkModel(fields.workModel)) {
    return false;
  }

  if (fields.seniority && !isSeniority(fields.seniority)) {
    return false;
  }

  if (fields.sourceName && !isSourceName(fields.sourceName)) {
    return false;
  }

  return true;
}

function normalizeStatus(value: string): JobStatus {
  return isJobStatus(value) ? value : "interesting";
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
