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
import { removeCompanyLogoFile } from "@/lib/company-logos";
import {
  linkLegacyJobsToCompany,
  renameCompanyLinks,
  syncCompanyStatus,
} from "@/lib/company-links";
import { db } from "@/lib/db";
import { companies, jobLeads, jobs } from "@/lib/db/schema";

export type CompanyMutationResult =
  | { ok: true }
  | { ok: false; error: "validation" | "not-found" | "linked-applications" };

type CompanyFormFields = {
  glassdoorUrl: string;
  jobBoardNavigationMode: string;
  jobsBoardUrl: string;
  logoUrl: string;
  name: string;
  notes: string;
  sector: string;
  size: string;
  status: string;
  website: string;
  atsProvider: string;
  atsBoardToken: string;
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
      atsProvider: fields.atsProvider || "auto",
      atsBoardToken: fields.atsBoardToken || null,
      glassdoorUrl: normalizeUrl(fields.glassdoorUrl),
      logoUrl: normalizeUrl(fields.logoUrl),
      status: normalizeStatus(fields.status),
      notes: fields.notes || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: companies.id })
    .get();

  // Only jobs saved under this name before the company existed can override
  // the status picked in the form.
  if (linkLegacyJobsToCompany(result.id, fields.name) > 0) {
    syncCompanyStatus(result.id);
  }

  revalidateCompanyViews(result.id);
  redirect(`/companies/${result.id}`);
}

export async function updateCompany(
  companyId: number,
  formData: FormData,
): Promise<CompanyMutationResult> {
  const existing = db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      logoUrl: companies.logoUrl,
      logoPath: companies.logoPath,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!existing) {
    return { ok: false, error: "not-found" };
  }

  const fields = readCompanyFields(formData);

  if (!isCompanyPayloadValid(fields)) {
    return { ok: false, error: "validation" };
  }

  const website = normalizeUrl(fields.website);
  const logoUrl = normalizeUrl(fields.logoUrl);
  // Another site or logo URL: the cached logo belongs to the old one.
  const logoSourceChanged =
    website !== existing.website || logoUrl !== existing.logoUrl;

  db.update(companies)
    .set({
      name: fields.name,
      website,
      sector: fields.sector || null,
      size: normalizeSize(fields.size),
      jobsBoardUrl: normalizeUrl(fields.jobsBoardUrl),
      jobBoardNavigationMode: normalizeJobBoardNavigationMode(
        fields.jobBoardNavigationMode,
      ),
      atsProvider: fields.atsProvider || "auto",
      // The edit form has no field for it: keep the stored token.
      atsBoardToken: formData.has("atsBoardToken")
        ? fields.atsBoardToken || null
        : undefined,
      glassdoorUrl: normalizeUrl(fields.glassdoorUrl),
      logoUrl,
      ...(logoSourceChanged ? { logoPath: null, logoCheckedAt: null } : {}),
      // Saved as picked. Applications only recalculate it when one is created
      // or changes status (syncCompanyStatusForApplication); recalculating
      // here would undo the choice right away.
      status: normalizeStatus(fields.status),
      notes: fields.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .run();

  if (logoSourceChanged) {
    await removeCompanyLogoFile(existing.logoPath);
  }

  renameCompanyLinks(companyId, existing.name, fields.name);

  revalidateCompanyViews(companyId);
  return { ok: true };
}

export async function deleteCompany(
  companyId: number,
  options: { redirectToList?: boolean } = {},
): Promise<CompanyMutationResult> {
  const existing = db
    .select({ id: companies.id, logoPath: companies.logoPath })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!existing) {
    if (options.redirectToList) {
      redirect("/companies");
    }

    return { ok: false, error: "not-found" };
  }

  const linkedJobsCount = db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.companyId, companyId))
    .get();

  if (Number(linkedJobsCount?.count ?? 0) > 0) {
    return { ok: false, error: "linked-applications" };
  }

  // Radar leads point at the company (foreign keys are on). With no jobs
  // linked, none of them became an application, so they go with it.
  db.transaction((tx) => {
    tx.delete(jobLeads).where(eq(jobLeads.companyId, companyId)).run();
    tx.delete(companies).where(eq(companies.id, companyId)).run();
  });

  await removeCompanyLogoFile(existing.logoPath);

  revalidateCompanyViews(companyId);
  revalidatePath("/leads");

  if (options.redirectToList) {
    redirect("/companies");
  }

  return { ok: true };
}

function readCompanyFields(formData: FormData): CompanyFormFields {
  return {
    glassdoorUrl: String(formData.get("glassdoorUrl") ?? "").trim(),
    jobBoardNavigationMode: String(
      formData.get("jobBoardNavigationMode") ?? "",
    ).trim(),
    jobsBoardUrl: String(formData.get("jobsBoardUrl") ?? "").trim(),
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    sector: String(formData.get("sector") ?? "").trim(),
    size: String(formData.get("size") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    atsProvider: String(formData.get("atsProvider") ?? "").trim(),
    atsBoardToken: String(formData.get("atsBoardToken") ?? "").trim(),
  };
}

function isCompanyPayloadValid(fields: CompanyFormFields) {
  if (!fields.name) {
    return false;
  }

  return [
    fields.website,
    fields.jobsBoardUrl,
    fields.glassdoorUrl,
    fields.logoUrl,
  ].every((value) => !value || isValidUrl(value));
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
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function revalidateCompanyViews(companyId: number) {
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/applications");
}
