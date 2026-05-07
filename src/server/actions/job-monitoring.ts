"use server";

import { and, eq, isNotNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { normalizeApplicationStatus } from "@/lib/applications";
import { createApplicationRecord } from "@/lib/applications/create-application-record";
import { isCompanyJobBoardNavigationMode } from "@/lib/companies";
import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { getRecentLeadFeedbackSummary } from "@/lib/job-monitoring/feedback";
import { runMonitoringForCompany } from "@/lib/job-monitoring";
import { isSeniority, isSourceName, isWorkModel } from "@/lib/jobs";
import { getProfileSnapshot } from "@/lib/profile/queries";
import type { ApplicationCreateResult } from "@/server/actions/applications";
import type { MonitoringSummary } from "@/lib/job-monitoring/types";

export type MonitoringActionResult = MonitoringSummary & {
  success: boolean;
  label: string;
  error?: string;
};

export async function runCompanyMonitoring(
  companyId: number,
): Promise<MonitoringActionResult> {
  if (!Number.isInteger(companyId)) {
    console.log("[job-monitoring] [action] invalid-company-id", { companyId });
    return invalidMonitoringResult("Empresa");
  }

  const company = db
    .select({
      id: companies.id,
      name: companies.name,
      jobsBoardUrl: companies.jobsBoardUrl,
      jobBoardNavigationMode: companies.jobBoardNavigationMode,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (
    !company ||
    !company.jobsBoardUrl ||
    !isValidUrl(company.jobsBoardUrl)
  ) {
    console.log("[job-monitoring] [action] company-not-monitorable", {
      companyId,
      companyExists: Boolean(company),
      jobsBoardUrl: company?.jobsBoardUrl ?? null,
    });
    return invalidMonitoringResult("Empresa");
  }

  try {
    console.log("[job-monitoring] [action] run-company-start", {
      companyId: company.id,
      companyName: company.name,
      jobsBoardUrl: company.jobsBoardUrl,
      navigationMode: company.jobBoardNavigationMode,
    });
    const profile = await getProfileSnapshot();
    const feedbackSummary = getRecentLeadFeedbackSummary();
    const summary = await runMonitoringForCompany(
      {
        id: company.id,
        name: company.name,
        jobsBoardUrl: company.jobsBoardUrl,
        jobBoardNavigationMode: isCompanyJobBoardNavigationMode(
          company.jobBoardNavigationMode,
        )
          ? company.jobBoardNavigationMode
          : "fetch",
      },
      {
        companyName: company.name,
        profile,
        feedbackSummary,
      },
    );

    revalidateRadarViews();
    console.log("[job-monitoring] [action] run-company-finished", {
      companyId: company.id,
      companyName: company.name,
      summary,
    });
    return {
      success: true,
      label: company.name,
      ...summary,
    };
  } catch (error) {
    return {
      success: false,
      label: company.name,
      ...emptySummary(),
      error:
        error instanceof Error
          ? error.message
          : "Falha ao rodar a varredura desta empresa.",
    };
  }
}

export async function runAllCompaniesMonitoring(): Promise<MonitoringActionResult> {
  const monitorableCompanies = db
    .select({
      id: companies.id,
      name: companies.name,
      jobsBoardUrl: companies.jobsBoardUrl,
      jobBoardNavigationMode: companies.jobBoardNavigationMode,
    })
    .from(companies)
    .where(isNotNull(companies.jobsBoardUrl))
    .all()
    .filter((company) => Boolean(company.jobsBoardUrl && isValidUrl(company.jobsBoardUrl)));

  console.log("[job-monitoring] [action] run-all-start", {
    companiesFound: monitorableCompanies.length,
    companies: monitorableCompanies.map((company) => ({
      id: company.id,
      name: company.name,
      jobsBoardUrl: company.jobsBoardUrl,
      navigationMode: company.jobBoardNavigationMode,
    })),
  });

  if (monitorableCompanies.length === 0) {
    return {
      success: true,
      label: "radar completo",
      ...emptySummary(),
    };
  }

  const profile = await getProfileSnapshot();
  const feedbackSummary = getRecentLeadFeedbackSummary();
  const summary = emptySummary();

  for (const company of monitorableCompanies) {
    try {
      console.log("[job-monitoring] [action] run-all-company", {
        companyId: company.id,
        companyName: company.name,
      });
      const companySummary = await runMonitoringForCompany(
        {
          id: company.id,
          name: company.name,
          jobsBoardUrl: company.jobsBoardUrl as string,
          jobBoardNavigationMode: isCompanyJobBoardNavigationMode(
            company.jobBoardNavigationMode,
          )
            ? company.jobBoardNavigationMode
            : "fetch",
        },
        {
          companyName: company.name,
          profile,
          feedbackSummary,
        },
      );

      accumulateSummary(summary, companySummary);
      console.log("[job-monitoring] [action] run-all-company-finished", {
        companyId: company.id,
        companyName: company.name,
        companySummary,
      });
    } catch (error) {
      console.log("[job-monitoring] [action] run-all-company-failed", {
        companyId: company.id,
        companyName: company.name,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
      continue;
    }
  }

  revalidateRadarViews();
  console.log("[job-monitoring] [action] run-all-finished", { summary });

  return {
    success: true,
    label: "radar completo",
    ...summary,
  };
}

export async function discardLead(leadId: number) {
  if (!Number.isInteger(leadId)) {
    return;
  }

  db.update(jobLeads)
    .set({
      classificationStatus: "discarded",
      userDecision: "dismissed",
      userDecisionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobLeads.id, leadId))
    .run();

  revalidateRadarViews();
}

export async function approveLead(leadId: number) {
  if (!Number.isInteger(leadId)) {
    return;
  }

  const lead = db
    .select({
      id: jobLeads.id,
      classificationStatus: jobLeads.classificationStatus,
      promotedToApplicationId: jobLeads.promotedToApplicationId,
    })
    .from(jobLeads)
    .where(eq(jobLeads.id, leadId))
    .get();

  if (
    !lead ||
    lead.classificationStatus === "discarded" ||
    lead.promotedToApplicationId !== null
  ) {
    return;
  }

  db.update(jobLeads)
    .set({
      userDecision: "approved",
      userDecisionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobLeads.id, leadId))
    .run();

  revalidateRadarViews();
}

export async function promoteApprovedLeadToApplication(
  _prev: ApplicationCreateResult | null,
  formData: FormData,
): Promise<ApplicationCreateResult> {
  const leadId = Number(String(formData.get("leadId") ?? "").trim());

  if (!Number.isInteger(leadId)) {
    return { success: false, error: "validation" };
  }

  const lead = db
    .select()
    .from(jobLeads)
    .where(
      and(
        eq(jobLeads.id, leadId),
        ne(jobLeads.classificationStatus, "discarded"),
        eq(jobLeads.userDecision, "approved"),
      ),
    )
    .get();

  if (!lead || lead.promotedToApplicationId) {
    return { success: false, error: "validation" };
  }

  const fields = readApplicationFields(formData);

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

  const companyId = Number(fields.companyId);

  if (!Number.isInteger(companyId)) {
    return { success: false, error: "validation" };
  }

  const result = createApplicationRecord({
    companyId,
    title: fields.title,
    description: fields.description,
    sourceUrl: fields.sourceUrl || null,
    sourceName: normalizeSourceName(fields.sourceName),
    workModel: normalizeWorkModel(fields.workModel),
    seniority: normalizeSeniority(fields.seniority),
    status: normalizeApplicationStatus(fields.status),
    notes: fields.notes || buildLeadPromotionNote(lead.classificationReason),
  });

  db.update(jobLeads)
    .set({
      promotedToApplicationId: result.applicationId,
      userDecision: "promoted",
      userDecisionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobLeads.id, leadId))
    .run();

  revalidateRadarViews();
  revalidatePath("/applications");
  revalidatePath("/companies");

  return { success: true, id: result.applicationId };
}

function buildLeadPromotionNote(reason: string | null) {
  if (!reason) {
    return "Promovida a partir do radar manual de vagas.";
  }

  return `Promovida a partir do radar manual de vagas. Motivo: ${reason}`;
}

function normalizeWorkModel(value: string | null) {
  return value && isWorkModel(value) ? value : null;
}

function normalizeSeniority(value: string | null) {
  return value && isSeniority(value) ? value : null;
}

function normalizeSourceName(value: string | null) {
  return value && isSourceName(value) ? value : "company_site";
}

function invalidMonitoringResult(label: string): MonitoringActionResult {
  return {
    success: false,
    label,
    ...emptySummary(),
    error: "Empresa fora do radar monitoravel.",
  };
}

type ApplicationFormFields = {
  companyId: string;
  title: string;
  description: string;
  sourceUrl: string;
  sourceName: string;
  workModel: string;
  seniority: string;
  status: string;
  notes: string;
};

function readApplicationFields(formData: FormData): ApplicationFormFields {
  return {
    companyId: String(formData.get("companyId") ?? "").trim(),
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

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function emptySummary(): MonitoringSummary {
  return {
    linksFound: 0,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 0,
  };
}

function accumulateSummary(target: MonitoringSummary, next: MonitoringSummary) {
  target.linksFound += next.linksFound;
  target.jobsParsed += next.jobsParsed;
  target.leadsSaved += next.leadsSaved;
  target.reviewsSaved += next.reviewsSaved;
  target.discarded += next.discarded;
  target.failed += next.failed;
}

function revalidateRadarViews() {
  revalidatePath("/companies");
  revalidatePath("/applications");
  revalidatePath("/leads");
}
