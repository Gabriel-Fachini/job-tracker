import { classifyJobLead } from "./classification";
import { discoverJobLinks } from "./discovery";
import { extractJobDetail } from "./extraction";
import { upsertJobLead } from "./persistence";
import type {
  ClassificationContext,
  MonitoringCompany,
  MonitoringSummary,
} from "./types";

export async function runMonitoringForCompany(
  company: MonitoringCompany,
  context: ClassificationContext,
  dependencies: {
    discoverJobLinksFn?: typeof discoverJobLinks;
    extractJobDetailFn?: typeof extractJobDetail;
    classifyJobLeadFn?: typeof classifyJobLead;
    upsertJobLeadFn?: typeof upsertJobLead;
  } = {},
): Promise<MonitoringSummary> {
  const discoverJobLinksFn =
    dependencies.discoverJobLinksFn ?? discoverJobLinks;
  const extractJobDetailFn =
    dependencies.extractJobDetailFn ?? extractJobDetail;
  const classifyJobLeadFn =
    dependencies.classifyJobLeadFn ?? classifyJobLead;
  const upsertJobLeadFn = dependencies.upsertJobLeadFn ?? upsertJobLead;

  if (new URL(company.jobsBoardUrl).hostname.includes("linkedin.com")) {
    logMonitoringStep(company.name, "skip-linkedin-source", {
      jobsBoardUrl: company.jobsBoardUrl,
    });
    return emptySummary();
  }

  logMonitoringStep(company.name, "start-company-run", {
    jobsBoardUrl: company.jobsBoardUrl,
    navigationMode: company.jobBoardNavigationMode,
  });

  const links = await discoverJobLinksFn(company);
  const summary: MonitoringSummary = {
    linksFound: links.length,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 0,
  };

  logMonitoringStep(company.name, "discovery-finished", {
    linksFound: links.length,
  });

  for (const [index, link] of links.entries()) {
    logMonitoringStep(company.name, "processing-link", {
      current: index + 1,
      total: links.length,
      url: link.url,
      hint: link.text,
    });

    let job;

    try {
      job = await extractJobDetailFn(link.url);
    } catch (error) {
      logMonitoringStep(company.name, "extract-failed", {
        url: link.url,
        error: getErrorMessage(error),
      });
      continue;
    }

    if (!job) {
      logMonitoringStep(company.name, "extract-empty", {
        url: link.url,
      });
      continue;
    }

    job = applyDiscoveryHints(job, link.text);
    logMonitoringStep(company.name, "job-extracted", {
      url: job.sourceUrl,
      title: job.title,
      sourceName: job.sourceName,
      workModel: job.workModel,
      seniority: job.seniority,
    });

    if (job.sourceName === "linkedin") {
      logMonitoringStep(company.name, "skip-linkedin-job", {
        url: job.sourceUrl,
        title: job.title,
      });
      continue;
    }

    summary.jobsParsed += 1;

    let classification;

    try {
      classification = await classifyJobLeadFn(job, context);
    } catch (error) {
      summary.failed += 1;
      logMonitoringStep(company.name, "classification-failed", {
        url: job.sourceUrl,
        title: job.title,
        error: getErrorMessage(error),
      });
      continue;
    }

    logMonitoringStep(company.name, "classification-finished", {
      url: job.sourceUrl,
      title: job.title,
      decision: classification.decision,
      score: classification.score,
      reason: classification.reason,
    });

    if (classification.decision === "discarded") {
      summary.discarded += 1;
      logMonitoringStep(company.name, "lead-discarded", {
        url: job.sourceUrl,
        title: job.title,
      });
      continue;
    }

    upsertJobLeadFn({
      companyId: company.id,
      title: job.title ?? link.text ?? "Vaga monitorada",
      sourceUrl: job.sourceUrl,
      sourceName: job.sourceName,
      description: job.description,
      workModel: job.workModel,
      seniority: job.seniority,
      locationText: job.locationText,
      salaryText: job.salaryText,
      classificationStatus: classification.decision,
      classificationScore: classification.score,
      classificationReason: classification.reason,
    });

    logMonitoringStep(company.name, "lead-persisted", {
      url: job.sourceUrl,
      title: job.title ?? link.text ?? "Vaga monitorada",
      status: classification.decision,
      score: classification.score,
    });

    summary.leadsSaved += 1;

    if (classification.decision === "review") {
      summary.reviewsSaved += 1;
    }
  }

  logMonitoringStep(company.name, "company-run-finished", summary);

  return summary;
}

function applyDiscoveryHints(job: NonNullable<Awaited<ReturnType<typeof extractJobDetail>>>, linkText: string | null) {
  if (!linkText) {
    return job;
  }

  const normalized = normalizeHintText(linkText);
  const hintedWorkModel = detectHintedWorkModel(normalized);
  const hintedSeniority = detectHintedSeniority(normalized);

  return {
    ...job,
    workModel: hintedWorkModel ?? job.workModel,
    seniority: hintedSeniority ?? job.seniority,
  };
}

function normalizeHintText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectHintedWorkModel(text: string) {
  if (/\btrabalho remoto\b|\bremoto\b|\bremote\b|\bhome office\b/.test(text)) {
    return "remote";
  }

  if (/\bhibrido\b|\bhybrid\b/.test(text)) {
    return "hybrid";
  }

  if (/\bpresencial\b|\bonsite\b/.test(text)) {
    return "onsite";
  }

  return null;
}

function detectHintedSeniority(text: string) {
  if (/\b(estagio|estagiario|internship|intern)\b/.test(text)) {
    return "intern";
  }

  if (/\b(junior|jr|trainee)\b/.test(text)) {
    return "junior";
  }

  if (/\b(pleno|mid)\b/.test(text)) {
    return "mid";
  }

  if (/\b(senior|sr)\b/.test(text)) {
    return "senior";
  }

  if (/\bstaff\b/.test(text)) {
    return "staff";
  }

  if (/\b(lead|lider)\b/.test(text)) {
    return "lead";
  }

  return null;
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

function logMonitoringStep(
  companyName: string,
  step: string,
  payload: Record<string, unknown>,
) {
  console.log(`[job-monitoring] [${companyName}] ${step}`, payload);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido";
}
