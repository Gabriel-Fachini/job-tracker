"use server";

import { desc, eq, ne } from "drizzle-orm";

import type { LeadListItem } from "@/components/leads/types";
import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { mapRawLeadToListItem } from "@/lib/job-leads/mapper";
import { leadListColumns } from "@/lib/job-leads/select";

export async function getLeads(): Promise<LeadListItem[]> {
  const items = db
    .select(leadListColumns)
    .from(jobLeads)
    .innerJoin(companies, eq(jobLeads.companyId, companies.id))
    .where(ne(jobLeads.classificationStatus, "discarded"))
    .orderBy(desc(jobLeads.updatedAt))
    .all()
    .map(mapRawLeadToListItem);

  return items;
}
