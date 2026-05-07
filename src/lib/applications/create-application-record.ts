import { eq } from "drizzle-orm";

import { syncCompanyStatusForApplication } from "@/lib/company-links";
import { db } from "@/lib/db";
import { applications, companies, jobs } from "@/lib/db/schema";
import type { ApplicationStatus } from "@/lib/applications";
import type { Seniority, SourceName, WorkModel } from "@/lib/jobs";

export type CreateApplicationRecordInput = {
  companyId: number;
  title: string;
  description: string;
  sourceUrl: string | null;
  sourceName: SourceName | null;
  workModel: WorkModel | null;
  seniority: Seniority | null;
  status: ApplicationStatus;
  notes: string | null;
};

export function createApplicationRecord(input: CreateApplicationRecordInput) {
  const company = db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .where(eq(companies.id, input.companyId))
    .get();

  if (!company) {
    throw new Error("Empresa invalida para criar candidatura.");
  }

  const now = new Date();
  const jobResult = db
    .insert(jobs)
    .values({
      companyId: company.id,
      company: company.name,
      title: input.title,
      description: input.description,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      status: "applied",
      workModel: input.workModel,
      seniority: input.seniority,
      createdAt: now,
    })
    .returning({ id: jobs.id })
    .get();

  const appResult = db
    .insert(applications)
    .values({
      jobId: jobResult.id,
      status: input.status,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: applications.id })
    .get();

  syncCompanyStatusForApplication(appResult.id);

  return {
    applicationId: appResult.id,
    jobId: jobResult.id,
  };
}
