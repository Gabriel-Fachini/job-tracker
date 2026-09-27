import test from "node:test";
import assert from "node:assert/strict";

import { runBulkMonitoring, RUN_ALREADY_ACTIVE_MESSAGE } from "./bulk-run";
import { createRunTracker } from "./run-state";
import type { MonitoringCompany, MonitoringStreamEvent, MonitoringSummary } from "./types";

function company(id: number, name: string): MonitoringCompany {
  return {
    id,
    name,
    jobsBoardUrl: `https://example.com/${name.toLowerCase()}/careers`,
    jobBoardNavigationMode: "fetch",
  };
}

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

const loadContext = async () => ({
  profile: null,
  feedbackSummary: { promotedExamples: [], dismissedExamples: [] },
});

const silentReport = () => {};

test("runBulkMonitoring keeps the run going after a company fails", async () => {
  const tracker = createRunTracker();
  const events: MonitoringStreamEvent[] = [];
  const statusWhileScanningBeta: string[] = [];

  const result = await runBulkMonitoring(
    [company(1, "Acme"), company(2, "Beta")],
    (event) => events.push(event),
    {
      tracker,
      runId: "run-test",
      report: silentReport,
      loadContext,
      runCompany: async (current) => {
        if (current.name === "Acme") {
          throw new Error("HTTP 500");
        }

        statusWhileScanningBeta.push(tracker.getSnapshot().status);
        return summary({ linksFound: 2, jobsParsed: 1, leadsSaved: 1, discarded: 1 });
      },
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.summary, summary({ linksFound: 2, jobsParsed: 1, leadsSaved: 1, discarded: 1 }));
  assert.deepEqual(statusWhileScanningBeta, ["running"]);
  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "company-start", "error", "company-start", "company-done", "all-done"],
  );
  assert.deepEqual(events[2], {
    type: "error",
    message: 'Falha ao processar empresa "Acme": HTTP 500',
    company: "Acme",
    fatal: false,
  });
  assert.deepEqual(tracker.getSnapshot(), { status: "idle", run: null });
});

test("runBulkMonitoring records company errors in the run snapshot", async () => {
  const tracker = createRunTracker();
  const errorsSeen: string[][] = [];

  await runBulkMonitoring([company(1, "Acme"), company(2, "Beta")], () => {}, {
    tracker,
    report: silentReport,
    loadContext,
    runCompany: async (current) => {
      if (current.name === "Acme") {
        throw new Error("board offline");
      }

      errorsSeen.push(tracker.getSnapshot().run?.companyErrors.map((error) => error.company) ?? []);
      return summary();
    },
  });

  assert.deepEqual(errorsSeen, [["Acme"]]);
});

test("runBulkMonitoring refuses to start while another run is active", async () => {
  const tracker = createRunTracker();
  tracker.tryStartRun("run-existing", 5);
  const events: MonitoringStreamEvent[] = [];
  let companiesScanned = 0;

  const result = await runBulkMonitoring([company(1, "Acme")], (event) => events.push(event), {
    tracker,
    report: silentReport,
    loadContext,
    runCompany: async () => {
      companiesScanned += 1;
      return summary();
    },
  });

  assert.equal(result.status, "rejected");
  assert.equal(companiesScanned, 0);
  assert.deepEqual(events, [
    { type: "error", message: RUN_ALREADY_ACTIVE_MESSAGE, fatal: true, reason: "already-running" },
  ]);
  const snapshot = tracker.getSnapshot();
  assert.equal(snapshot.status, "running");
  assert.equal(snapshot.run?.id, "run-existing");
  assert.equal(snapshot.run?.totalCompanies, 5);
});

test("runBulkMonitoring stops between companies once aborted", async () => {
  const tracker = createRunTracker();
  const disconnect = new AbortController();
  const events: MonitoringStreamEvent[] = [];
  const scanned: string[] = [];

  const result = await runBulkMonitoring(
    [company(1, "Acme"), company(2, "Beta")],
    (event) => events.push(event),
    {
      tracker,
      signal: disconnect.signal,
      report: silentReport,
      loadContext,
      runCompany: async (current, _context, dependencies) => {
        scanned.push(current.name);
        disconnect.abort();
        assert.equal(dependencies.signal.aborted, true);
        return summary({ linksFound: 1 });
      },
    },
  );

  assert.equal(result.status, "cancelled");
  assert.deepEqual(scanned, ["Acme"]);
  assert.equal(events.some((event) => event.type === "all-done"), false);
  assert.deepEqual(tracker.getSnapshot(), { status: "idle", run: null });
});

test("runBulkMonitoring treats a consumer that throws as disconnected", async () => {
  const tracker = createRunTracker();
  const scanned: string[] = [];

  const result = await runBulkMonitoring(
    [company(1, "Acme"), company(2, "Beta")],
    () => {
      throw new TypeError("Invalid state: Controller is already closed");
    },
    {
      tracker,
      report: silentReport,
      loadContext,
      runCompany: async (current) => {
        scanned.push(current.name);
        return summary();
      },
    },
  );

  assert.equal(result.status, "cancelled");
  assert.deepEqual(scanned, []);
  assert.deepEqual(tracker.getSnapshot(), { status: "idle", run: null });
});

test("runBulkMonitoring ends as failed, not stuck running, when the context can't load", async () => {
  const tracker = createRunTracker();
  const events: MonitoringStreamEvent[] = [];

  const result = await runBulkMonitoring([company(1, "Acme")], (event) => events.push(event), {
    tracker,
    report: silentReport,
    loadContext: async () => {
      throw new Error("database is locked");
    },
    runCompany: async () => summary(),
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(events.at(-1), {
    type: "error",
    message: "Falha ao rodar o radar: database is locked",
    fatal: true,
  });
  assert.deepEqual(tracker.getSnapshot(), { status: "idle", run: null });
  assert.equal(tracker.tryStartRun("run-next", 1).ok, true);
});

test("runBulkMonitoring finishes right away when no company is monitorable", async () => {
  const tracker = createRunTracker();
  const events: MonitoringStreamEvent[] = [];
  let contextLoads = 0;

  const result = await runBulkMonitoring([], (event) => events.push(event), {
    tracker,
    report: silentReport,
    loadContext: async () => {
      contextLoads += 1;
      return loadContext();
    },
    runCompany: async () => summary(),
  });

  assert.equal(result.status, "completed");
  assert.equal(contextLoads, 0);
  assert.deepEqual(events, [
    { type: "start", total: 0 },
    { type: "all-done", summary: summary() },
  ]);
});
