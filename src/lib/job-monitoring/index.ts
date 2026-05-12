import pLimit from "p-limit";

import { formatJobDescriptionAsMarkdown } from "@/lib/ai/openai";
import { classifyJobLead } from "./classification";
import { discoverJobLinks } from "./discovery";
import { extractJobDetail, htmlToMarkdown, detectSourceName } from "./extraction";
import { logMonitoringStep } from "./logger";
import { getExistingJobLeadUrls, touchLastViewed, upsertJobLead } from "./persistence";
import type {
  ClassificationContext,
  MonitoringCompany,
  MonitoringSummary,
  MonitoringStreamEvent,
} from "./types";

const LINK_PROCESSING_CONCURRENCY = 5;

export async function runMonitoringForCompany(
  company: MonitoringCompany,
  context: ClassificationContext,
  dependencies: {
    discoverJobLinksFn?: typeof discoverJobLinks;
    extractJobDetailFn?: typeof extractJobDetail;
    classifyJobLeadFn?: typeof classifyJobLead;
    upsertJobLeadFn?: typeof upsertJobLead;
    onEvent?: (event: MonitoringStreamEvent) => void;
  } = {},
): Promise<MonitoringSummary> {
  const discoverJobLinksFn =
    dependencies.discoverJobLinksFn ?? discoverJobLinks;
  const extractJobDetailFn =
    dependencies.extractJobDetailFn ?? extractJobDetail;
  const classifyJobLeadFn =
    dependencies.classifyJobLeadFn ?? classifyJobLead;
  const upsertJobLeadFn = dependencies.upsertJobLeadFn ?? upsertJobLead;
  const onEvent = dependencies.onEvent;

  const companyStart = Date.now();

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

  const discoveryStart = Date.now();
  const links = await discoverJobLinksFn(company);
  logMonitoringStep(company.name, "discovery-finished", {
    linksFound: links.length,
    durationMs: Date.now() - discoveryStart,
  });

  // Filter already-processed links
  const existingUrls = getExistingJobLeadUrls(
    company.id,
    links.map((l) => l.url),
  );
  const newLinks = links.filter((l) => !existingUrls.has(l.url));
  const skippedCount = links.length - newLinks.length;

  const skippedUrls: string[] = [];
  for (const link of links) {
    if (existingUrls.has(link.url)) {
      skippedUrls.push(link.url);
      onEvent?.({ type: "link-skipped", url: link.url, companyId: company.id });
    }
  }
  touchLastViewed(company.id, skippedUrls);

  logMonitoringStep(company.name, "skip-filter-applied", {
    total: links.length,
    newLinks: newLinks.length,
    skipped: skippedCount,
  });

  const summary: MonitoringSummary = {
    linksFound: links.length,
    skippedLinks: skippedCount,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 0,
  };

  // Phase 1: Extract + Classify + Upsert in parallel with concurrency limit
  const limit = pLimit(LINK_PROCESSING_CONCURRENCY);
  let processedCount = 0;

  await Promise.allSettled(
    newLinks.map((link, index) =>
      limit(async () => {
        try {
        logMonitoringStep(company.name, "processing-link", {
          current: index + 1,
          total: newLinks.length,
          url: link.url,
          hint: link.text,
        });

        let job;
        const extractStart = Date.now();

        try {
          // Use prefetched data if available
          if (link.prefetched) {
            const prefetched = link.prefetched;
            let descriptionMarkdown = prefetched.descriptionMarkdown;

            // Convert HTML to markdown if not already done
            if (!descriptionMarkdown && prefetched.descriptionHtml) {
              descriptionMarkdown = htmlToMarkdown(prefetched.descriptionHtml);
            }

            job = {
              title: prefetched.title,
              description: descriptionMarkdown || null,
              sourceUrl: link.url,
              sourceName: detectSourceName(link.url),
              workModel: null,
              seniority: null,
              locationText: prefetched.locationText || null,
              salaryText: null,
            };

            logMonitoringStep(company.name, "extract-prefetched", {
              url: link.url,
              title: prefetched.title,
              durationMs: Date.now() - extractStart,
            });
          } else {
            job = await extractJobDetailFn(link.url);
          }
        } catch (error) {
          logMonitoringStep(company.name, "extract-failed", {
            url: link.url,
            error: getErrorMessage(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: Date.now() - extractStart,
          });
          summary.failed += 1;
          return { processed: 1 };
        }

        if (!job) {
          logMonitoringStep(company.name, "extract-empty", {
            url: link.url,
            durationMs: Date.now() - extractStart,
          });
          return { processed: 1 };
        }

        job = applyDiscoveryHints(job, link.text);

        // Format job description as markdown if enabled
        if (
          process.env.OPENAI_FORMAT_JOB_DESCRIPTIONS === "true" &&
          job.description &&
          !(/\n\n/.test(job.description) || /^#|^- |^\* |\*\*/m.test(job.description))
        ) {
          try {
            const formatted = await formatJobDescriptionAsMarkdown(job.description);
            job = { ...job, description: formatted };
            logMonitoringStep(company.name, "description-formatted", {
              url: job.sourceUrl,
              title: job.title,
            });
          } catch (error) {
            logMonitoringStep(company.name, "description-format-failed", {
              url: job.sourceUrl,
              title: job.title,
              error: getErrorMessage(error),
            });
          }
        }

        logMonitoringStep(company.name, "job-extracted", {
          url: job.sourceUrl,
          title: job.title,
          sourceName: job.sourceName,
          workModel: job.workModel,
          seniority: job.seniority,
          durationMs: Date.now() - extractStart,
        });

        if (job.sourceName === "linkedin") {
          logMonitoringStep(company.name, "skip-linkedin-job", {
            url: job.sourceUrl,
            title: job.title,
          });
          return { processed: 1 };
        }

        let classification;
        const classifyStart = Date.now();

        try {
          classification = await classifyJobLeadFn(job, context);
        } catch (error) {
          logMonitoringStep(company.name, "classification-failed", {
            url: job.sourceUrl,
            title: job.title,
            error: getErrorMessage(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: Date.now() - classifyStart,
          });
          summary.failed += 1;
          return { processed: 1 };
        }

        logMonitoringStep(company.name, "classification-finished", {
          url: job.sourceUrl,
          title: job.title,
          decision: classification.decision,
          score: classification.score,
          reason: classification.reason,
          durationMs: Date.now() - classifyStart,
        });

        // Upsert immediately (within Phase 1)
        const upsertStart = Date.now();
        const upsertResult = upsertJobLeadFn({
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

        if (classification.decision === "discarded") {
          summary.discarded += 1;
          logMonitoringStep(company.name, "lead-discarded", {
            url: job.sourceUrl,
            title: job.title,
          });
          onEvent?.({
            type: "link-done",
            company: company.name,
            title: job.title ?? link.text ?? "Vaga monitorada",
            decision: classification.decision,
            processed: processedCount + 1,
            total: newLinks.length,
          });
          return { processed: 1 };
        }

        summary.jobsParsed += 1;

        logMonitoringStep(company.name, "lead-persisted", {
          url: job.sourceUrl,
          title: job.title ?? link.text ?? "Vaga monitorada",
          status: classification.decision,
          score: classification.score,
          leadId: upsertResult.id,
          isNew: upsertResult.created,
          durationMs: Date.now() - upsertStart,
        });

        summary.leadsSaved += 1;

        if (classification.decision === "review") {
          summary.reviewsSaved += 1;
        }

        onEvent?.({
          type: "link-done",
          company: company.name,
          title: job.title ?? link.text ?? "Vaga monitorada",
          decision: classification.decision,
          processed: processedCount + 1,
          total: newLinks.length,
          lead: upsertResult.leadSnapshot,
        });

        return { processed: 1 };
        } finally {
          processedCount += 1;
          onEvent?.({
            type: "link-processing",
            company: company.name,
            title: link.text,
            processed: processedCount,
            total: newLinks.length,
          });
        }
      })
    )
  );

  logMonitoringStep(company.name, "company-run-finished", {
    ...summary,
    durationMs: Date.now() - companyStart,
  });

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
    skippedLinks: 0,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 0,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido";
}
