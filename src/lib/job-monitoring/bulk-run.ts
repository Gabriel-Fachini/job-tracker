import { printRadarReport, type CompanyReportEntry } from "./logger";
import { runTracker, type RunOutcome, type RunTracker } from "./run-state";
import type {
  ClassificationContext,
  MonitoringCompany,
  MonitoringStreamEvent,
  MonitoringSummary,
} from "./types";

export const RUN_ALREADY_ACTIVE_MESSAGE =
  "Já existe uma varredura do radar em andamento.";

type CompanyRunner = (
  company: MonitoringCompany,
  context: ClassificationContext,
  dependencies: {
    onEvent: (event: MonitoringStreamEvent) => void;
    signal: AbortSignal;
  },
) => Promise<MonitoringSummary>;

export type BulkRunOptions = {
  /** Scans one company: runMonitoringForCompany in production. */
  runCompany: CompanyRunner;
  /** Profile and recent feedback, loaded once the run is claimed. */
  loadContext: () => Promise<Omit<ClassificationContext, "companyName">>;
  /** Aborted when the client goes away; the run stops between links and companies. */
  signal?: AbortSignal;
  tracker?: RunTracker;
  runId?: string;
  report?: (results: CompanyReportEntry[], totalDurationMs: number) => void;
};

export type BulkRunResult = {
  status: RunOutcome | "rejected";
  summary: MonitoringSummary;
};

/**
 * Runs the radar over `companies` in sequence, streaming events to `emit`.
 * Only one run is active per process: a second call while one is running is
 * refused with a fatal `already-running` error. A company that throws is
 * reported and skipped; the run itself only ends with all-done, a
 * cancellation or an unexpected failure, and its state is always cleared.
 */
export async function runBulkMonitoring(
  companies: MonitoringCompany[],
  emit: (event: MonitoringStreamEvent) => void,
  options: BulkRunOptions,
): Promise<BulkRunResult> {
  const tracker = options.tracker ?? runTracker;
  const report = options.report ?? printRadarReport;
  const runId =
    options.runId ?? `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // A consumer that can't take events anymore is treated like a disconnect.
  const consumerGone = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, consumerGone.signal])
    : consumerGone.signal;

  function send(event: MonitoringStreamEvent) {
    try {
      emit(event);
    } catch {
      consumerGone.abort();
    }
  }

  function emitEvent(event: MonitoringStreamEvent) {
    tracker.recordEvent(runId, event);
    send(event);
  }

  const claim = tracker.tryStartRun(runId, companies.length);

  if (!claim.ok) {
    console.log("[job-monitoring] [action] run-all-stream-rejected", {
      activeRunId: claim.activeRun.id,
    });
    send({
      type: "error",
      message: RUN_ALREADY_ACTIVE_MESSAGE,
      fatal: true,
      reason: "already-running",
    });
    return { status: "rejected", summary: emptySummary() };
  }

  const startedAt = Date.now();
  const results: CompanyReportEntry[] = [];
  let outcome: RunOutcome = "failed";
  let failure: string | null = null;

  async function runOneCompany(
    company: MonitoringCompany,
    index: number,
    baseContext: Omit<ClassificationContext, "companyName">,
  ) {
    const companyStartedAt = Date.now();
    console.log("[job-monitoring] [action] run-all-stream-company-start", {
      companyId: company.id,
      companyName: company.name,
      index: index + 1,
      total: companies.length,
    });
    emitEvent({
      type: "company-start",
      company: company.name,
      index: index + 1,
      total: companies.length,
    });

    try {
      const summary = await options.runCompany(
        company,
        { ...baseContext, companyName: company.name },
        { onEvent: emitEvent, signal },
      );
      results.push({
        name: company.name,
        summary,
        durationMs: Date.now() - companyStartedAt,
      });
      emitEvent({ type: "company-done", company: company.name, summary });
      console.log("[job-monitoring] [action] run-all-stream-company-finished", {
        companyId: company.id,
        companyName: company.name,
        companySummary: summary,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      results.push({
        name: company.name,
        summary: emptySummary(),
        durationMs: Date.now() - companyStartedAt,
      });
      console.log("[job-monitoring] [action] run-all-stream-company-failed", {
        companyId: company.id,
        companyName: company.name,
        error: message,
      });
      // One broken board must not end the run: report it and go to the next company.
      emitEvent({
        type: "error",
        message: `Falha ao processar empresa "${company.name}": ${message}`,
        company: company.name,
        fatal: false,
      });
    }
  }

  try {
    emitEvent({ type: "start", total: companies.length });

    if (companies.length > 0) {
      const baseContext = await options.loadContext();

      for (const [index, company] of companies.entries()) {
        if (signal.aborted) {
          break;
        }

        await runOneCompany(company, index, baseContext);
      }
    }

    const summary = sumSummaries(results.map((result) => result.summary));
    report(results, Date.now() - startedAt);

    if (signal.aborted) {
      outcome = "cancelled";
      console.log("[job-monitoring] [action] run-all-stream-cancelled", {
        companiesProcessed: results.length,
        total: companies.length,
      });
      return { status: "cancelled", summary };
    }

    emitEvent({ type: "all-done", summary });
    outcome = "completed";
    console.log("[job-monitoring] [action] run-all-stream-finished", {
      companiesProcessed: results.length,
      durationMs: Date.now() - startedAt,
    });
    return { status: "completed", summary };
  } catch (error) {
    failure = getErrorMessage(error);
    console.log("[job-monitoring] [action] run-all-stream-failed", { error: failure });
    send({ type: "error", message: `Falha ao rodar o radar: ${failure}`, fatal: true });
    return {
      status: "failed",
      summary: sumSummaries(results.map((result) => result.summary)),
    };
  } finally {
    tracker.finishRun(runId, outcome, failure);
  }
}

function sumSummaries(summaries: MonitoringSummary[]): MonitoringSummary {
  return summaries.reduce(
    (total, summary) => ({
      linksFound: total.linksFound + summary.linksFound,
      skippedLinks: total.skippedLinks + summary.skippedLinks,
      jobsParsed: total.jobsParsed + summary.jobsParsed,
      leadsSaved: total.leadsSaved + summary.leadsSaved,
      reviewsSaved: total.reviewsSaved + summary.reviewsSaved,
      discarded: total.discarded + summary.discarded,
      failed: total.failed + summary.failed,
    }),
    emptySummary(),
  );
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
