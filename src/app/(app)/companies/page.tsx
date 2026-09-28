import { desc, ne, sql } from "drizzle-orm";

import type { CompanyFormValues } from "@/components/companies/company-form";
import { CompaniesClient, type CompanyListItem } from "@/components/companies/companies-client";
import { getCompanyLogoView } from "@/lib/company-logos";
import { DISCARDED_SINK_COMPANY_NAME } from "@/lib/companies/company-origin";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const rows: CompanyListItem[] = db
    .select({
      id: companies.id,
      name: companies.name,
      status: companies.status,
      origin: companies.origin,
      sector: companies.sector,
      size: companies.size,
      website: companies.website,
      jobsBoardUrl: companies.jobsBoardUrl,
      jobBoardNavigationMode: companies.jobBoardNavigationMode,
      atsProvider: companies.atsProvider,
      glassdoorUrl: companies.glassdoorUrl,
      notes: companies.notes,
      logoUrl: companies.logoUrl,
      logoPath: companies.logoPath,
      logoCheckedAt: companies.logoCheckedAt,
      radarEnabled: companies.radarEnabled,
      updatedAt: companies.updatedAt,
      // Spelled out: in a single-table select drizzle leaves column names
      // unqualified, which makes correlated subqueries ambiguous.
      applicationsCount: sql<number>`(select count(*) from applications a inner join jobs j on a.job_id = j.id where j.company_id = companies.id)`,
      // Any job blocks deleting; leads go with the company.
      jobsCount: sql<number>`(select count(*) from jobs j where j.company_id = companies.id)`,
      leadsCount: sql<number>`(select count(*) from job_leads l where l.company_id = companies.id)`,
    })
    .from(companies)
    // The sink that holds discarded aggregator leads is bookkeeping, not a company.
    .where(ne(companies.name, DISCARDED_SINK_COMPANY_NAME))
    // Companies the user registered come first; imported/aggregated ones follow.
    .orderBy(sql`case when ${companies.origin} = 'manual' then 0 else 1 end`, desc(companies.updatedAt))
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      origin: row.origin,
      sector: row.sector,
      size: row.size,
      website: row.website,
      updatedAt: row.updatedAt,
      radarEnabled: row.radarEnabled,
      applicationsCount: Number(row.applicationsCount ?? 0),
      jobsCount: Number(row.jobsCount ?? 0),
      leadsCount: Number(row.leadsCount ?? 0),
      // Imported/aggregated companies would trigger one logo lookup per row on
      // first view (hundreds of requests): they show the monogram unless a logo
      // is already cached or set by hand.
      logo: getCompanyLogoView(row, { lookup: row.origin === "manual" }),
      // Everything the row's edit sheet opens with, so it opens instantly.
      formValues: {
        name: row.name,
        website: row.website ?? "",
        sector: row.sector ?? "",
        size: row.size ?? "",
        jobsBoardUrl: row.jobsBoardUrl ?? "",
        jobBoardNavigationMode: row.jobBoardNavigationMode ?? "fetch",
        atsProvider: row.atsProvider,
        glassdoorUrl: row.glassdoorUrl ?? "",
        logoUrl: row.logoUrl ?? "",
        status: row.status,
        notes: row.notes ?? "",
      } satisfies CompanyFormValues,
    }));

  return <CompaniesClient rows={rows} />;
}
