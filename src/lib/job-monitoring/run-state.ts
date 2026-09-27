import type {
  MonitoringRunSnapshot,
  MonitoringStreamEvent,
  MonitoringSummary,
} from "./types";

/**
 * A run with no event for this long is treated as dead: it stops blocking new
 * runs and deploys. A healthy run emits an event every few seconds; its
 * slowest silent steps (browser discovery, an Ollama timeout) stay well below.
 */
export const RUN_STALE_AFTER_MS = 15 * 60 * 1000;

export type RunOutcome = "completed" | "failed" | "cancelled";

export type RunCompanyError = {
  company: string;
  message: string;
  at: Date;
};

export type RunStats = {
  /** interesting + review, like MonitoringSummary.leadsSaved. */
  saved: number;
  review: number;
  discarded: number;
  failed: number;
};

export type RunState = {
  id: string;
  status: "running" | RunOutcome;
  startedAt: Date;
  endedAt: Date | null;
  currentCompany: string | null;
  companyIndex: number;
  totalCompanies: number;
  /** Progress inside the current company, reset on every company-start. */
  linksProcessed: number;
  linksTotal: number;
  eventCount: number;
  lastUpdatedAt: Date;
  stats: RunStats;
  /** Companies that failed. The run goes on without them. */
  companyErrors: RunCompanyError[];
  /** Why the run itself failed (status "failed"). */
  error: string | null;
};

export type StartRunResult =
  | { ok: true; run: RunState }
  | { ok: false; activeRun: RunState };

type RunTrackerOptions = {
  now?: () => Date;
  staleAfterMs?: number;
};

export function createRunTracker(options: RunTrackerOptions = {}) {
  const now = options.now ?? (() => new Date());
  const staleAfterMs = options.staleAfterMs ?? RUN_STALE_AFTER_MS;
  let currentRun: RunState | null = null;

  function isStale(run: RunState) {
    return now().getTime() - run.lastUpdatedAt.getTime() >= staleAfterMs;
  }

  /** The run that blocks a new one: still running and not stale. */
  function getActiveRun(): RunState | null {
    return currentRun && currentRun.status === "running" && !isStale(currentRun)
      ? currentRun
      : null;
  }

  function tryStartRun(id: string, totalCompanies: number): StartRunResult {
    const activeRun = getActiveRun();

    if (activeRun) {
      return { ok: false, activeRun };
    }

    const startedAt = now();
    currentRun = {
      id,
      status: "running",
      startedAt,
      endedAt: null,
      currentCompany: null,
      companyIndex: 0,
      totalCompanies,
      linksProcessed: 0,
      linksTotal: 0,
      eventCount: 0,
      lastUpdatedAt: startedAt,
      stats: { saved: 0, review: 0, discarded: 0, failed: 0 },
      companyErrors: [],
      error: null,
    };

    return { ok: true, run: currentRun };
  }

  /** Applies a stream event to its run. Events from a replaced run are ignored. */
  function recordEvent(runId: string, event: MonitoringStreamEvent) {
    const run = currentRun;

    if (!run || run.id !== runId) {
      return;
    }

    run.eventCount += 1;
    run.lastUpdatedAt = now();

    switch (event.type) {
      case "start":
        run.totalCompanies = event.total;
        break;
      case "company-start":
        run.currentCompany = event.company;
        run.companyIndex = event.index;
        run.totalCompanies = event.total;
        run.linksProcessed = 0;
        run.linksTotal = 0;
        break;
      case "link-processing":
        run.linksProcessed = event.processed;
        run.linksTotal = event.total;
        break;
      case "link-done":
        run.linksProcessed = event.processed;
        run.linksTotal = event.total;

        if (event.decision === "discarded") {
          run.stats.discarded += 1;
        } else {
          run.stats.saved += 1;

          if (event.decision === "review") {
            run.stats.review += 1;
          }
        }
        break;
      case "company-done":
        run.stats.failed += event.summary.failed;
        break;
      case "error":
        // A company error never ends the run; the run's own outcome comes from finishRun.
        if (event.company) {
          run.companyErrors.push({
            company: event.company,
            message: event.message,
            at: now(),
          });
        }
        break;
      case "all-done":
        run.stats = statsFromSummary(event.summary);
        break;
      case "link-skipped":
        break;
    }
  }

  /** Ends the run and clears it. A call for a replaced run changes nothing. */
  function finishRun(
    runId: string,
    outcome: RunOutcome,
    error: string | null = null,
  ): RunState | null {
    const run = currentRun;

    if (!run || run.id !== runId) {
      return null;
    }

    const endedAt = now();
    run.status = outcome;
    run.endedAt = endedAt;
    run.lastUpdatedAt = endedAt;
    run.currentCompany = null;
    run.error = error;
    currentRun = null;

    return run;
  }

  /** What `GET /api/monitoring/current` returns. */
  function getSnapshot(): MonitoringRunSnapshot {
    const run = currentRun;

    if (!run) {
      return { status: "idle", run: null };
    }

    return {
      status: isStale(run) ? "stale" : "running",
      run: {
        id: run.id,
        startedAt: run.startedAt.toISOString(),
        endedAt: run.endedAt?.toISOString() ?? null,
        currentCompany: run.currentCompany,
        companyIndex: run.companyIndex,
        totalCompanies: run.totalCompanies,
        linksProcessed: run.linksProcessed,
        linksTotal: run.linksTotal,
        stats: { ...run.stats },
        companyErrors: run.companyErrors.map((companyError) => ({
          company: companyError.company,
          message: companyError.message,
          at: companyError.at.toISOString(),
        })),
        eventCount: run.eventCount,
        lastUpdatedAt: run.lastUpdatedAt.toISOString(),
      },
    };
  }

  return { tryStartRun, recordEvent, finishRun, getActiveRun, getSnapshot };
}

export type RunTracker = ReturnType<typeof createRunTracker>;

function statsFromSummary(summary: MonitoringSummary): RunStats {
  return {
    saved: summary.leadsSaved,
    review: summary.reviewsSaved,
    discarded: summary.discarded,
    failed: summary.failed,
  };
}

// One tracker per process, shared by the stream route and the snapshot route
// (and kept across dev HMR, like the SQLite connection in src/lib/db).
const globalForRunTracker = globalThis as { jobMonitoringRunTracker?: RunTracker };

export const runTracker =
  globalForRunTracker.jobMonitoringRunTracker ?? createRunTracker();

globalForRunTracker.jobMonitoringRunTracker = runTracker;
