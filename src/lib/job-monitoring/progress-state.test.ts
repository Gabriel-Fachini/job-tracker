import test from "node:test";
import assert from "node:assert/strict";

import {
  applyMonitoringStreamEvent,
  createStreamProgress,
  isFatalMonitoringError,
  progressFromSnapshot,
} from "./progress-state";
import type { MonitoringStreamEvent, MonitoringSummary } from "./types";

function summary(overrides: Partial<MonitoringSummary> = {}): MonitoringSummary {
  return {
    linksFound: 0,
    skippedLinks: 0,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 0,
    ...overrides,
  };
}

function applyAll(events: MonitoringStreamEvent[]) {
  return events.reduce(applyMonitoringStreamEvent, createStreamProgress(null));
}

test("a company error keeps the client running", () => {
  const progress = applyAll([
    { type: "start", total: 2 },
    { type: "company-start", company: "Acme", index: 1, total: 2 },
    {
      type: "error",
      message: 'Falha ao processar empresa "Acme": HTTP 500',
      company: "Acme",
      fatal: false,
    },
  ]);

  assert.equal(progress.isRunning, true);
  assert.equal(progress.result, null);
  assert.equal(progress.events[0]?.type, "error");
  assert.equal(progress.events[0]?.message, 'Falha ao processar empresa "Acme": HTTP 500');
});

test("live stats count like the server summary", () => {
  const progress = applyAll([
    { type: "start", total: 1 },
    { type: "company-start", company: "Acme", index: 1, total: 1 },
    { type: "link-done", company: "Acme", title: "A", decision: "interesting", processed: 1, total: 4 },
    { type: "link-done", company: "Acme", title: "B", decision: "review", processed: 2, total: 4 },
    { type: "link-done", company: "Acme", title: "C", decision: "discarded", processed: 3, total: 4 },
    {
      type: "company-done",
      company: "Acme",
      summary: summary({ linksFound: 4, leadsSaved: 2, reviewsSaved: 1, discarded: 1, failed: 1 }),
    },
  ]);

  // "salvos" is interesting + review, like MonitoringSummary.leadsSaved.
  assert.deepEqual(progress.stats, { leadsSaved: 2, reviewsSaved: 1, discarded: 1, failed: 1 });
  assert.equal(progress.isRunning, true);
});

test("all-done ends the run with a success result", () => {
  const finalSummary = summary({ linksFound: 3, leadsSaved: 2, reviewsSaved: 1, discarded: 1 });
  const progress = applyAll([
    { type: "start", total: 1 },
    { type: "company-start", company: "Acme", index: 1, total: 1 },
    { type: "all-done", summary: finalSummary },
  ]);

  assert.equal(progress.isRunning, false);
  assert.equal(progress.currentCompany, null);
  assert.equal(progress.result?.success, true);
  assert.deepEqual(progress.stats, { leadsSaved: 2, reviewsSaved: 1, discarded: 1, failed: 0 });
});

test("a fatal error marks the run as failed but leaves ending it to the server check", () => {
  const progress = applyAll([
    { type: "start", total: 1 },
    { type: "error", message: "Falha ao rodar o radar: database is locked", fatal: true },
  ]);

  assert.equal(progress.isRunning, true);
  assert.equal(progress.result?.success, false);
  assert.equal(progress.result?.error, "Falha ao rodar o radar: database is locked");
});

test("a refused start is not reported as a failed run", () => {
  const progress = applyAll([
    {
      type: "error",
      message: "Já existe uma varredura do radar em andamento.",
      fatal: true,
      reason: "already-running",
    },
  ]);

  assert.equal(progress.result, null);
  assert.equal(progress.events[0]?.message, "Já existe uma varredura do radar em andamento.");
});

test("isFatalMonitoringError tells run errors from company errors", () => {
  assert.equal(isFatalMonitoringError({ type: "error", message: "x", fatal: true }), true);
  assert.equal(isFatalMonitoringError({ type: "error", message: "x" }), true);
  assert.equal(
    isFatalMonitoringError({ type: "error", message: "x", company: "Acme", fatal: false }),
    false,
  );
  assert.equal(isFatalMonitoringError({ type: "start", total: 1 }), false);
});

test("progressFromSnapshot maps the server run and keeps the local log", () => {
  const withLog = applyAll([
    { type: "error", message: "Já existe uma varredura do radar em andamento.", fatal: true, reason: "already-running" },
  ]);

  const progress = progressFromSnapshot(
    {
      id: "run-1",
      startedAt: "2026-09-27T12:00:00.000Z",
      endedAt: null,
      currentCompany: "Beta",
      companyIndex: 2,
      totalCompanies: 3,
      linksProcessed: 4,
      linksTotal: 10,
      stats: { saved: 5, review: 2, discarded: 1, failed: 0 },
      companyErrors: [],
      eventCount: 12,
      lastUpdatedAt: "2026-09-27T12:01:00.000Z",
    },
    withLog,
  );

  assert.equal(progress.isRunning, true);
  assert.equal(progress.eventSource, null);
  assert.equal(progress.currentCompany, "Beta");
  assert.equal(progress.linksProcessed, 4);
  assert.deepEqual(progress.stats, { leadsSaved: 5, reviewsSaved: 2, discarded: 1, failed: 0 });
  assert.equal(progress.events.length, 1);
});
