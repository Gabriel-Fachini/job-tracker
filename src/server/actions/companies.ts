"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isCompanyJobBoardNavigationMode,
  isCompanySize,
  isCompanyStatus,
  type CompanyJobBoardNavigationMode,
  type CompanySize,
  type CompanyStatus,
} from "@/lib/companies";
import {
  linkLegacyJobsToCompany,
  renameCompanyLinks,
  syncCompanyStatus,
} from "@/lib/company-links";
import { db } from "@/lib/db";
import { companies, jobs } from "@/lib/db/schema";

type CompanyFormFields = {
  glassdoorUrl: string;
  jobBoardNavigationMode: string;
  jobsBoardUrl: string;
  name: string;
  notes: string;
  sector: string;
  size: string;
  status: string;
  website: string;
};

export async function createCompany(formData: FormData) {
  const fields = readCompanyFields(formData);

  if (!isCompanyPayloadValid(fields)) {
    redirect("/companies/new?error=validation");
  }

  const now = new Date();

  const result = db
    .insert(companies)
    .values({
      name: fields.name,
      website: normalizeUrl(fields.website),
      sector: fields.sector || null,
      size: normalizeSize(fields.size),
      jobsBoardUrl: normalizeUrl(fields.jobsBoardUrl),
      jobBoardNavigationMode: normalizeJobBoardNavigationMode(
        fields.jobBoardNavigationMode,
      ),
      glassdoorUrl: normalizeUrl(fields.glassdoorUrl),
      status: normalizeStatus(fields.status),
      notes: fields.notes || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: companies.id })
    .get();

  linkLegacyJobsToCompany(result.id, fields.name);
  syncCompanyStatus(result.id);

  revalidateCompanyViews(result.id);
  redirect(`/companies/${result.id}`);
}

export async function updateCompany(companyId: number, formData: FormData) {
  const existing = db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!existing) {
    redirect("/companies");
  }

  const fields = readCompanyFields(formData);

  if (!isCompanyPayloadValid(fields)) {
    redirect(`/companies/${companyId}?error=validation`);
  }

  db.update(companies)
    .set({
      name: fields.name,
      website: normalizeUrl(fields.website),
      sector: fields.sector || null,
      size: normalizeSize(fields.size),
      jobsBoardUrl: normalizeUrl(fields.jobsBoardUrl),
      jobBoardNavigationMode: normalizeJobBoardNavigationMode(
        fields.jobBoardNavigationMode,
      ),
      glassdoorUrl: normalizeUrl(fields.glassdoorUrl),
      status: normalizeStatus(fields.status),
      notes: fields.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .run();

  renameCompanyLinks(companyId, existing.name, fields.name);
  syncCompanyStatus(companyId);

  revalidateCompanyViews(companyId);
  redirect(`/companies/${companyId}`);
}

export async function deleteCompany(companyId: number) {
  const existing = db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!existing) {
    redirect("/companies");
  }

  const linkedJobsCount = db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.companyId, companyId))
    .get();

  if (Number(linkedJobsCount?.count ?? 0) > 0) {
    redirect(`/companies/${companyId}?error=linked-applications`);
  }

  db.delete(companies).where(eq(companies.id, companyId)).run();

  revalidateCompanyViews(companyId);
  redirect("/companies");
}

function readCompanyFields(formData: FormData): CompanyFormFields {
  return {
    glassdoorUrl: String(formData.get("glassdoorUrl") ?? "").trim(),
    jobBoardNavigationMode: String(
      formData.get("jobBoardNavigationMode") ?? "",
    ).trim(),
    jobsBoardUrl: String(formData.get("jobsBoardUrl") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    sector: String(formData.get("sector") ?? "").trim(),
    size: String(formData.get("size") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
  };
}

function isCompanyPayloadValid(fields: CompanyFormFields) {
  if (!fields.name) {
    return false;
  }

  return [fields.website, fields.jobsBoardUrl, fields.glassdoorUrl].every(
    (value) => !value || isValidUrl(value),
  );
}

function normalizeSize(value: string): CompanySize | null {
  return isCompanySize(value) ? value : null;
}

function normalizeStatus(value: string): CompanyStatus {
  return isCompanyStatus(value) ? value : "monitoring";
}

function normalizeJobBoardNavigationMode(
  value: string,
): CompanyJobBoardNavigationMode {
  return isCompanyJobBoardNavigationMode(value) ? value : "fetch";
}

function normalizeUrl(value: string) {
  return value ? value : null;
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function revalidateCompanyViews(companyId: number) {
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/applications");
}
