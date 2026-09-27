import type {
  MonitoringProgress,
  MonitoringProgressEvent,
} from "@/components/leads/monitoring-run-button";

import type {
  MonitoringRunSnapshot,
  MonitoringStreamEvent,
  MonitoringSummary,
} from "./types";

type RunningSnapshot = Extract<MonitoringRunSnapshot, { status: "running" | "stale" }>["run"];

/** Progress of a run this tab just started and follows through its own stream. */
export function createStreamProgress(eventSource: EventSource | null): MonitoringProgress {
  return {
    isRunning: true,
    currentCompany: null,
    companyIndex: 0,
    totalCompanies: 0,
    linksProcessed: 0,
    linksTotal: 0,
    events: [],
    stats: { leadsSaved: 0, reviewsSaved: 0, discarded: 0, failed: 0 },
    result: null,
    eventSource,
  };
}

/**
 * Progress of a run this tab has no stream for (reload, second tab, refused
 * start), rebuilt from `GET /api/monitoring/current`. Keeps the log it had.
 */
export function progressFromSnapshot(
  run: RunningSnapshot,
  prev: MonitoringProgress | null,
): MonitoringProgress {
  return {
    isRunning: true,
    currentCompany: run.currentCompany,
    companyIndex: run.companyIndex,
    totalCompanies: run.totalCompanies,
    linksProcessed: run.linksProcessed,
    linksTotal: run.linksTotal,
    events: prev?.events ?? [],
    stats: {
      leadsSaved: run.stats.saved,
      reviewsSaved: run.stats.review,
      discarded: run.stats.discarded,
      failed: run.stats.failed,
    },
    result: null,
    eventSource: null,
  };
}

/** The stream ends after this event: the run failed or was refused. */
export function isFatalMonitoringError(event: MonitoringStreamEvent) {
  return event.type === "error" && event.fatal !== false && !event.company;
}

/**
 * Applies one SSE event. Only all-done ends the run here; a fatal error is
 * settled with the server by the caller (another run may still be going).
 */
export function applyMonitoringStreamEvent(
  prev: MonitoringProgress,
  event: MonitoringStreamEvent,
): MonitoringProgress {
  const progressEvent = toProgressEvent(event);
  const events = progressEvent ? [progressEvent, ...prev.events] : prev.events;

  switch (event.type) {
    case "start":
      return { ...prev, isRunning: true, totalCompanies: event.total, events };
    case "company-start":
      return {
        ...prev,
        currentCompany: event.company,
        companyIndex: event.index,
        totalCompanies: event.total,
        linksProcessed: 0,
        linksTotal: 0,
        events,
      };
    case "link-processing":
      return { ...prev, linksProcessed: event.processed, linksTotal: event.total, events };
    case "link-done": {
      // Same counting as the server summary: "salvos" is interesting + review.
      const stats = { ...prev.stats };
      if (event.decision === "discarded") {
        stats.discarded += 1;
      } else {
        stats.leadsSaved += 1;
        if (event.decision === "review") {
          stats.reviewsSaved += 1;
        }
      }
      return { ...prev, linksProcessed: event.processed, linksTotal: event.total, stats, events };
    }
    case "company-done":
      // Link failures only reach the client through the company summary.
      return {
        ...prev,
        stats: { ...prev.stats, failed: prev.stats.failed + event.summary.failed },
        events,
      };
    case "all-done":
      return {
        ...prev,
        isRunning: false,
        currentCompany: null,
        stats: {
          leadsSaved: event.summary.leadsSaved,
          reviewsSaved: event.summary.reviewsSaved,
          discarded: event.summary.discarded,
          failed: event.summary.failed,
        },
        result: { ...event.summary, success: true, label: "radar completo" },
        events,
      };
    case "error":
      if (!isFatalMonitoringError(event) || event.reason === "already-running") {
        return { ...prev, events };
      }
      return {
        ...prev,
        result: { ...emptySummary(), success: false, label: "radar", error: event.message },
        events,
      };
    default:
      return prev;
  }
}

function toProgressEvent(event: MonitoringStreamEvent): MonitoringProgressEvent | null {
  const id = `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();

  switch (event.type) {
    case "company-start":
      return {
        id,
        timestamp,
        type: "company-start",
        message: `Buscando em ${event.company}`,
        detail: `Empresa ${event.index} de ${event.total}`,
      };
    case "link-done":
      return { id, timestamp, type: "link-done", message: event.title, detail: event.decision };
    case "company-done":
      return { id, timestamp, type: "company-done", message: `${event.company} concluído` };
    case "error":
      return { id, timestamp, type: "error", message: event.message };
    default:
      return null;
  }
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
