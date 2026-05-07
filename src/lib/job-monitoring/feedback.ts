import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";

import type { ClassificationFeedbackSummary } from "./types";

const MAX_FEEDBACK_EXAMPLES = 3;

export function getRecentLeadFeedbackSummary(): ClassificationFeedbackSummary {
  const promotedRows = db
    .select({
      title: jobLeads.title,
      companyName: companies.name,
      reason: jobLeads.classificationReason,
    })
    .from(jobLeads)
    .innerJoin(companies, eq(jobLeads.companyId, companies.id))
    .where(eq(jobLeads.userDecision, "promoted"))
    .orderBy(desc(jobLeads.userDecisionAt), desc(jobLeads.updatedAt))
    .limit(MAX_FEEDBACK_EXAMPLES)
    .all();

  const dismissedRows = db
    .select({
      title: jobLeads.title,
      companyName: companies.name,
      reason: jobLeads.classificationReason,
    })
    .from(jobLeads)
    .innerJoin(companies, eq(jobLeads.companyId, companies.id))
    .where(
      and(
        eq(jobLeads.userDecision, "dismissed"),
        ne(jobLeads.classificationStatus, "review"),
      ),
    )
    .orderBy(desc(jobLeads.userDecisionAt), desc(jobLeads.updatedAt))
    .limit(MAX_FEEDBACK_EXAMPLES)
    .all();

  return {
    promotedExamples: promotedRows.map(formatFeedbackExample),
    dismissedExamples: dismissedRows.map(formatFeedbackExample),
  };
}

function formatFeedbackExample(row: {
  title: string;
  companyName: string;
  reason: string | null;
}) {
  return row.reason
    ? `${row.title} em ${row.companyName}: ${row.reason}`
    : `${row.title} em ${row.companyName}`;
}
