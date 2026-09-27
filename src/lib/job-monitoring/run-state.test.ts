import test from "node:test";
import assert from "node:assert/strict";

import { createRunTracker, RUN_STALE_AFTER_MS } from "./run-state";
import type { MonitoringSummary } from "./types";

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

function createClock(start = Date.parse("2026-09-27T12:00:00Z")) {
  let current = start;
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

test("tryStartRun refuses a second run while one is active", () => {
  const tracker = createRunTracker();

  const first = tracker.tryStartRun("run-a", 2);
  const second = tracker.tryStartRun("run-b", 2);

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.ok ? null : second.activeRun.id, "run-a");
  assert.equal(tracker.getSnapshot().run?.id, "run-a");
});

test("a company error is recorded without ending the run", () => {
  const tracker = createRunTracker();
  tracker.tryStartRun("run-a", 3);

  tracker.recordEvent("run-a", {
    type: "error",
    message: 'Falha ao processar empresa "Acme": HTTP 500',
    company: "Acme",
    fatal: false,
  });
  tracker.recordEvent("run-a", { type: "company-start", company: "Beta", index: 2, total: 3 });

  const snapshot = tracker.getSnapshot();
  assert.equal(snapshot.status, "running");
  assert.equal(snapshot.run?.currentCompany, "Beta");
  assert.deepEqual(
    snapshot.run?.companyErrors.map(({ company, message }) => ({ company, message })),
    [{ company: "Acme", message: 'Falha ao processar empresa "Acme": HTTP 500' }],
  );
  assert.equal(tracker.tryStartRun("run-b", 1).ok, false);
});

test("link events feed progress and stats into the snapshot", () => {
  const tracker = createRunTracker();
  tracker.tryStartRun("run-a", 1);

  tracker.recordEvent("run-a", { type: "company-start", company: "Acme", index: 1, total: 1 });
  tracker.recordEvent("run-a", {
    type: "link-done",
    company: "Acme",
    title: "Frontend",
    decision: "interesting",
    processed: 1,
    total: 4,
  });
  tracker.recordEvent("run-a", {
    type: "link-done",
    company: "Acme",
    title: "Platform",
    decision: "review",
    processed: 2,
    total: 4,
  });
  tracker.recordEvent("run-a", {
    type: "link-done",
    company: "Acme",
    title: "Sales",
    decision: "discarded",
    processed: 3,
    total: 4,
  });
  tracker.recordEvent("run-a", {
    type: "link-processing",
    company: "Acme",
    title: null,
    processed: 4,
    total: 4,
  });
  tracker.recordEvent("run-a", {
    type: "company-done",
    company: "Acme",
    summary: summary({ linksFound: 4, leadsSaved: 2, reviewsSaved: 1, discarded: 1, failed: 1 }),
  });

  const run = tracker.getSnapshot().run;
  assert.equal(run?.linksProcessed, 4);
  assert.equal(run?.linksTotal, 4);
  // "saved" follows MonitoringSummary.leadsSaved: interesting + review.
  assert.deepEqual(run?.stats, { saved: 2, review: 1, discarded: 1, failed: 1 });
  assert.equal(run?.eventCount, 6);
});

test("company-start resets the per-company link progress", () => {
  const tracker = createRunTracker();
  tracker.tryStartRun("run-a", 2);

  tracker.recordEvent("run-a", { type: "company-start", company: "Acme", index: 1, total: 2 });
  tracker.recordEvent("run-a", {
    type: "link-processing",
    company: "Acme",
    title: null,
    processed: 3,
    total: 3,
  });
  tracker.recordEvent("run-a", { type: "company-start", company: "Beta", index: 2, total: 2 });

  const run = tracker.getSnapshot().run;
  assert.equal(run?.companyIndex, 2);
  assert.equal(run?.linksProcessed, 0);
  assert.equal(run?.linksTotal, 0);
});

test("finishRun clears the run and returns its final state", () => {
  const tracker = createRunTracker();
  tracker.tryStartRun("run-a", 1);
  tracker.recordEvent("run-a", {
    type: "all-done",
    summary: summary({ leadsSaved: 3, reviewsSaved: 1, discarded: 2, failed: 1 }),
  });

  const finished = tracker.finishRun("run-a", "completed");

  assert.equal(finished?.status, "completed");
  assert.ok(finished?.endedAt instanceof Date);
  assert.deepEqual(finished?.stats, { saved: 3, review: 1, discarded: 2, failed: 1 });
  assert.deepEqual(tracker.getSnapshot(), { status: "idle", run: null });
  assert.equal(tracker.tryStartRun("run-b", 1).ok, true);
});

test("a run with no events for too long is stale and stops blocking new runs", () => {
  const clock = createClock();
  const tracker = createRunTracker({ now: clock.now });
  tracker.tryStartRun("run-a", 1);

  clock.advance(RUN_STALE_AFTER_MS - 1);
  assert.equal(tracker.getSnapshot().status, "running");
  assert.equal(tracker.tryStartRun("run-b", 1).ok, false);

  clock.advance(1);
  assert.equal(tracker.getSnapshot().status, "stale");
  assert.equal(tracker.getActiveRun(), null);
  assert.equal(tracker.tryStartRun("run-b", 1).ok, true);
  assert.equal(tracker.getSnapshot().run?.id, "run-b");
});

test("an event keeps a slow run from going stale", () => {
  const clock = createClock();
  const tracker = createRunTracker({ now: clock.now });
  tracker.tryStartRun("run-a", 1);

  clock.advance(RUN_STALE_AFTER_MS - 1);
  tracker.recordEvent("run-a", { type: "company-start", company: "Acme", index: 1, total: 1 });
  clock.advance(RUN_STALE_AFTER_MS - 1);

  assert.equal(tracker.getSnapshot().status, "running");
});

test("events and finishRun from a replaced run are ignored", () => {
  const clock = createClock();
  const tracker = createRunTracker({ now: clock.now });
  tracker.tryStartRun("run-a", 1);
  clock.advance(RUN_STALE_AFTER_MS);
  tracker.tryStartRun("run-b", 2);

  tracker.recordEvent("run-a", { type: "company-start", company: "Old", index: 1, total: 1 });
  const finishedOld = tracker.finishRun("run-a", "completed");

  assert.equal(finishedOld, null);
  assert.equal(tracker.getSnapshot().status, "running");
  assert.equal(tracker.getSnapshot().run?.id, "run-b");
  assert.equal(tracker.getSnapshot().run?.currentCompany, null);
});
