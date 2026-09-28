import pLimit from "p-limit";

import { buildDedupKey } from "@/lib/companies/normalize";
import { createCompanyResolver, type CompanyResolver } from "@/lib/companies/resolve";

import { classifyJobLead } from "./classification";
import { logMonitoringStep } from "./logger";
import {
  findLeadByDedupKey,
  getExistingLeadUrlsAnyCompany,
  touchLastViewedByUrls,
  upsertJobLead,
} from "./persistence";
import { sourceFetchers } from "./sources";
import { sourceJobToDetail } from "./sources/format";
import { recordSourceRun } from "./sources/store";
import {
  sourceStepLabel,
  type MonitoringSource,
  type SourceFetchResult,
  type SourceJob,
} from "./sources/types";
import type {
  ClassificationContext,
  MonitoringStreamEvent,
  MonitoringSummary,
} from "./types";

const SOURCE_JOB_CONCURRENCY = 5;

/** Why a vacancy is discarded before any model sees it (stage 0). */
export type ScreenRejection = { reason: string };

export async function runMonitoringForSource(
  source: MonitoringSource,
  context: Omit<ClassificationContext, "companyName">,
  dependencies: {
    fetchSourceFn?: (source: MonitoringSource, signal?: AbortSignal) => Promise<SourceFetchResult>;
    classifyJobLeadFn?: typeof classifyJobLead;
    upsertJobLeadFn?: typeof upsertJobLead;
    findLeadByDedupKeyFn?: typeof findLeadByDedupKey;
    existingUrlsFn?: (urls: string[]) => Set<string>;
    touchUrlsFn?: (urls: string[]) => void;
    recordRunFn?: typeof recordSourceRun;
    resolver?: CompanyResolver;
    /** Hard filters: a rejection is saved as discarded without calling a model. */
    screenFn?: (job: SourceJob) => ScreenRejection | null;
    onEvent?: (event: MonitoringStreamEvent) => void;
    signal?: AbortSignal;
  } = {},
): Promise<MonitoringSummary> {
  const label = sourceStepLabel(source);
  const classifyJobLeadFn = dependencies.classifyJobLeadFn ?? classifyJobLead;
  const upsertJobLeadFn = dependencies.upsertJobLeadFn ?? upsertJobLead;
  const findLeadByDedupKeyFn = dependencies.findLeadByDedupKeyFn ?? findLeadByDedupKey;
  const existingUrlsFn = dependencies.existingUrlsFn ?? getExistingLeadUrlsAnyCompany;
  const touchUrlsFn = dependencies.touchUrlsFn ?? touchLastViewedByUrls;
  const recordRunFn = dependencies.recordRunFn ?? recordSourceRun;
  const fetchSourceFn =
    dependencies.fetchSourceFn ??
    ((src, signal) =>
      sourceFetchers[src.kind]({ config: src.config, cursor: src.cursor, signal }));
  const onEvent = dependencies.onEvent;
  const signal = dependencies.signal;
  let resolver = dependencies.resolver;
  const startedAt = Date.now();

  const summary: MonitoringSummary = {
    linksFound: 0,
    skippedLinks: 0,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 0,
  };

  let fetched: SourceFetchResult;

  try {
    fetched = await fetchSourceFn(source, signal);
  } catch (error) {
    const message = getErrorMessage(error);
    logMonitoringStep(label, "source-fetch-failed", { error: message });
    recordRunFn(source.id, { ok: false, error: message });
    throw error;
  }

  const jobs = fetched.jobs;
  summary.linksFound = jobs.length;
  logMonitoringStep(label, "source-fetched", {
    jobs: jobs.length,
    durationMs: Date.now() - startedAt,
  });

  // Known URLs first (cheap), then the same vacancy already seen from another source.
  const knownUrls = existingUrlsFn(jobs.map((job) => job.url));
  const knownList = jobs.filter((job) => knownUrls.has(job.url));
  const seenKeys = new Set<string>();
  const fresh: Array<{ job: SourceJob; dedupKey: string }> = [];

  for (const job of jobs) {
    if (knownUrls.has(job.url)) {
      onEvent?.({ type: "link-skipped", url: job.url, companyId: 0 });
      continue;
    }

    const dedupKey = buildDedupKey(job.companyName, job.title);

    if (seenKeys.has(dedupKey) || findLeadByDedupKeyFn(dedupKey)) {
      summary.skippedLinks += 1;
      onEvent?.({ type: "link-skipped", url: job.url, companyId: 0 });
      continue;
    }

    seenKeys.add(dedupKey);
    fresh.push({ job, dedupKey });
  }

  summary.skippedLinks += knownList.length;
  touchUrlsFn(knownList.map((job) => job.url));

  logMonitoringStep(label, "skip-filter-applied", {
    total: jobs.length,
    newJobs: fresh.length,
    skipped: summary.skippedLinks,
  });

  const limit = pLimit(SOURCE_JOB_CONCURRENCY);
  let processed = 0;

  await Promise.allSettled(
    fresh.map(({ job, dedupKey }) =>
      limit(async () => {
        if (signal?.aborted) {
          return;
        }

        try {
          const detail = sourceJobToDetail(job);
          const rejection = dependencies.screenFn?.(job) ?? null;
          const persistBase = {
            title: job.title,
            sourceUrl: job.url,
            sourceName: detail.sourceName,
            sourceKind: job.sourceKind,
            externalId: job.externalId,
            applyUrl: job.applyUrl ?? null,
            dedupKey,
            description: detail.description,
            workModel: detail.workModel,
            seniority: detail.seniority,
            locationText: detail.locationText,
            salaryText: detail.salaryText,
          };

          if (rejection) {
            resolver ??= createCompanyResolver();
            upsertJobLeadFn({
              ...persistBase,
              companyId: resolver.discardedSinkId(),
              classificationStatus: "discarded",
              classificationScore: 0,
              classificationReason: rejection.reason,
            });
            summary.discarded += 1;
            onEvent?.({
              type: "link-done",
              company: label,
              title: job.title,
              decision: "discarded",
              processed: processed + 1,
              total: fresh.length,
            });
            return;
          }

          let classification;

          try {
            classification = await classifyJobLeadFn(detail, {
              ...context,
              companyName: job.companyName,
            });
          } catch (error) {
            logMonitoringStep(label, "classification-failed", {
              url: job.url,
              title: job.title,
              error: getErrorMessage(error),
            });
            summary.failed += 1;
            return;
          }

          // Discarded leads go to the sink company: only vacancies worth a look
          // create (or reuse) a real company.
          resolver ??= createCompanyResolver();
          const companyId =
            classification.decision === "discarded"
              ? resolver.discardedSinkId()
              : resolver.resolve({ name: job.companyName, website: job.companyWebsite }).id;

          const result = upsertJobLeadFn({
            ...persistBase,
            companyId,
            classificationStatus: classification.decision,
            classificationScore: classification.score,
            classificationReason: classification.reason,
          });

          if (classification.decision === "discarded") {
            summary.discarded += 1;
            onEvent?.({
              type: "link-done",
              company: label,
              title: job.title,
              decision: classification.decision,
              processed: processed + 1,
              total: fresh.length,
            });
            return;
          }

          summary.jobsParsed += 1;
          summary.leadsSaved += 1;

          if (classification.decision === "review") {
            summary.reviewsSaved += 1;
          }

          onEvent?.({
            type: "link-done",
            company: label,
            title: job.title,
            decision: classification.decision,
            processed: processed + 1,
            total: fresh.length,
            lead: result.leadSnapshot,
          });
        } catch (error) {
          logMonitoringStep(label, "source-job-failed", {
            url: job.url,
            title: job.title,
            error: getErrorMessage(error),
          });
          summary.failed += 1;
        } finally {
          processed += 1;
          onEvent?.({
            type: "link-processing",
            company: label,
            title: job.title,
            processed,
            total: fresh.length,
          });
        }
      }),
    ),
  );

  // Jobs that were cancelled or failed must come back on the next run.
  const complete = !signal?.aborted && summary.failed === 0;

  recordRunFn(source.id, {
    ok: true,
    ...(complete ? { cursor: fetched.cursor ?? source.cursor } : {}),
  });

  logMonitoringStep(label, "source-run-finished", {
    ...summary,
    durationMs: Date.now() - startedAt,
  });

  return summary;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido";
}
