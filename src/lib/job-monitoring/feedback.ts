import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";

import { getDiscardReasonLabel } from "./triage/discard-reasons";
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
      userDiscardReason: jobLeads.userDiscardReason,
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
    dismissedExamples: dismissedRows.map(formatDismissedExample),
  };
}

/** A manual discard reads "Título em Empresa: descartada pelo usuário (motivo)" when the user said why. */
export function formatDismissedExample(row: {
  title: string;
  companyName: string;
  reason: string | null;
  userDiscardReason?: string | null;
}) {
  const userReason = getDiscardReasonLabel(row.userDiscardReason);

  if (userReason) {
    return `${row.title} em ${row.companyName}: descartada pelo usuário (${userReason.toLowerCase()})`;
  }

  return formatFeedbackExample(row);
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
