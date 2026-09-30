import assert from "node:assert/strict";
import test from "node:test";

import { runBulkMonitoring } from "./bulk-run";
import { createRunTracker } from "./run-state";
import type { MonitoringSource } from "./sources/types";
import type { MonitoringCompany, MonitoringStreamEvent, MonitoringSummary } from "./types";

const company: MonitoringCompany = {
  id: 1,
  name: "Acme",
  jobsBoardUrl: "https://example.com/careers",
  jobBoardNavigationMode: "fetch",
};

const sources: MonitoringSource[] = [
  { id: 1, kind: "himalayas", name: "Himalayas", config: {}, cursor: null },
  { id: 2, kind: "remoteok", name: "Remote OK", config: {}, cursor: null },
];

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

test("runBulkMonitoring runs each source as a step after the companies", async () => {
  const tracker = createRunTracker();
  const events: MonitoringStreamEvent[] = [];

  const result = await runBulkMonitoring([company], (event) => events.push(event), {
    tracker,
    report: () => {},
    loadContext,
    runCompany: async () => summary({ leadsSaved: 1, jobsParsed: 1 }),
    sources,
    runSource: async (source, _context, { onEvent }) => {
      onEvent({ type: "link-processing", company: `Fonte: ${source.name}`, title: "x", processed: 1, total: 1 });
      return summary({ leadsSaved: 2, jobsParsed: 2 });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.summary.leadsSaved, 5);
  assert.deepEqual(
    events.filter((event) => event.type === "company-start").map((event) => event.type === "company-start" && [event.company, event.index, event.total]),
    [
      ["Acme", 1, 3],
      ["Fonte: Himalayas", 2, 3],
      ["Fonte: Remote OK", 3, 3],
    ],
  );
  assert.deepEqual(events[0], { type: "start", total: 3 });
  assert.deepEqual(tracker.getSnapshot(), { status: "idle", run: null });
});

test("runBulkMonitoring reports a failing source and continues with the next one", async () => {
  const events: MonitoringStreamEvent[] = [];

  const result = await runBulkMonitoring([], (event) => events.push(event), {
    tracker: createRunTracker(),
    report: () => {},
    loadContext,
    runCompany: async () => summary(),
    sources,
    runSource: async (source) => {
      if (source.kind === "himalayas") {
        throw new Error("HTTP 503 em himalayas.app");
      }

      return summary({ leadsSaved: 1, jobsParsed: 1 });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.summary.leadsSaved, 1);

  const error = events.find((event) => event.type === "error");
  assert.deepEqual(error, {
    type: "error",
    message: 'Falha ao processar fonte "Fonte: Himalayas": HTTP 503 em himalayas.app',
    company: "Fonte: Himalayas",
    fatal: false,
  });
  assert.equal(events.at(-1)?.type, "all-done");
});

test("runBulkMonitoring does not run sources once the run is cancelled", async () => {
  const controller = new AbortController();
  const ran: string[] = [];

  const result = await runBulkMonitoring([company], () => {}, {
    tracker: createRunTracker(),
    report: () => {},
    loadContext,
    signal: controller.signal,
    runCompany: async () => {
      controller.abort();
      return summary();
    },
    sources,
    runSource: async (source) => {
      ran.push(source.name);
      return summary();
    },
  });

  assert.equal(result.status, "cancelled");
  assert.deepEqual(ran, []);
});
