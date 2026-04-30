import "server-only";

import { eq, or, sql } from "drizzle-orm";

import { deriveCompanyStatus, isCompanyStatus } from "@/lib/companies";
import { db } from "@/lib/db";
import { applications, companies, jobs } from "@/lib/db/schema";

function exactCompanyNameCondition(name: string) {
  return sql`${jobs.companyId} is null and lower(trim(coalesce(${jobs.company}, ''))) = lower(trim(${name}))`;
}

export function findCompanyByName(name: string) {
  const normalized = name.trim();

  if (!normalized) {
    return null;
  }

  return (
    db
      .select({
        id: companies.id,
        name: companies.name,
      })
      .from(companies)
      .where(sql`lower(trim(${companies.name})) = lower(trim(${normalized}))`)
      .get() ?? null
  );
}

export function linkLegacyJobsToCompany(companyId: number, companyName: string) {
  const normalized = companyName.trim();

  if (!normalized) {
    return;
  }

  db.update(jobs)
    .set({
      companyId,
      company: normalized,
    })
    .where(exactCompanyNameCondition(normalized))
    .run();
}

export function renameCompanyLinks(
  companyId: number,
  previousName: string,
  nextName: string,
) {
  const nextNormalized = nextName.trim();

  const update = db.update(jobs).set({
    companyId,
    company: nextNormalized || null,
  });

  if (previousName.trim()) {
    update
      .where(or(eq(jobs.companyId, companyId), exactCompanyNameCondition(previousName.trim())))
      .run();

    return;
  }

  update.where(eq(jobs.companyId, companyId)).run();
}

export function syncCompanyStatus(companyId: number) {
  const company = db
    .select({
      id: companies.id,
      status: companies.status,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!company) {
    return;
  }

  const rows = db
    .select({
      status: applications.status,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(jobs.companyId, companyId))
    .all();

  const currentStatus = isCompanyStatus(company.status) ? company.status : null;

  const nextStatus = deriveCompanyStatus(
    rows.map((row) => row.status),
    currentStatus,
  );

  if (nextStatus === currentStatus) {
    return;
  }

  db.update(companies)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .run();
}

export function syncCompanyStatusForApplication(applicationId: number) {
  const row = db
    .select({
      applicationId: applications.id,
      jobId: jobs.id,
      companyId: jobs.companyId,
      companyName: jobs.company,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.id, applicationId))
    .get();

  if (!row) {
    return;
  }

  let companyId = row.companyId;

  if (!companyId && row.companyName) {
    const company = findCompanyByName(row.companyName);

    if (company) {
      companyId = company.id;

      db.update(jobs)
        .set({
          companyId,
          company: company.name,
        })
        .where(eq(jobs.id, row.jobId))
        .run();
    }
  }

  if (companyId) {
    syncCompanyStatus(companyId);
  }
}
