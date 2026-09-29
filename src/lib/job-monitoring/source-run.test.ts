import assert from "node:assert/strict";
import test from "node:test";

import type { LeadListItem } from "@/components/leads/types";
import { emptyLeadTriage } from "@/lib/job-leads/defaults";
import { buildDedupKey } from "@/lib/companies/normalize";
import type { CompanyResolver } from "@/lib/companies/resolve";

import { runMonitoringForSource } from "./source-run";
import { classificationToTriageResult } from "./triage/adapter";
import { emptyTriageFields } from "./triage/types";
import type { MonitoringSource, SourceJob } from "./sources/types";
import type { MonitoringStreamEvent, PersistableLead } from "./types";

const source: MonitoringSource = {
  id: 7,
  kind: "himalayas",
  name: "Himalayas",
  config: {},
  cursor: "100",
};

const context = {
  profile: null,
  feedbackSummary: { promotedExamples: [], dismissedExamples: [] },
};

function job(n: number, overrides: Partial<SourceJob> = {}): SourceJob {
  return {
    sourceKind: "himalayas",
    externalId: `job-${n}`,
    url: `https://feed.example/jobs/${n}`,
    title: `Backend Engineer ${n}`,
    companyName: `Company ${n}`,
    descriptionHtml: `<p>Description ${n}</p>`,
    locationText: "Remote",
    salary: { min: 5000, max: 6000, currency: "USD", period: "month" },
    ...overrides,
  };
}

function snapshot(lead: PersistableLead): LeadListItem {
  return {
    id: 1,
    title: lead.title,
    sourceUrl: lead.sourceUrl,
    sourceName: lead.sourceName,
    sourceKind: lead.sourceKind ?? null,
    applyUrl: lead.applyUrl ?? null,
    ...emptyLeadTriage,
    description: lead.description,
    workModel: lead.workModel,
    seniority: lead.seniority,
    locationText: lead.locationText,
    salaryText: lead.salaryText,
    classificationStatus: lead.classificationStatus,
    classificationScore: lead.classificationScore,
    classificationReason: lead.classificationReason,
    userDecision: "none",
    promotedToApplicationId: null,
    discoveredAt: new Date(),
    updatedAt: new Date(),
    companyId: lead.companyId,
    companyName: "x",
  };
}

function fakeResolver() {
  const resolved: string[] = [];
  const resolver: CompanyResolver = {
    resolve: (candidate) => {
      resolved.push(candidate.name);
      return { id: 100 + resolved.length, created: true };
    },
    discardedSinkId: () => 999,
  };

  return { resolver, resolved };
}

const classification = (decision: "interesting" | "review" | "discarded") => ({
  decision,
  score: decision === "discarded" ? 10 : 80,
  reason: `reason ${decision}`,
  matchedSignals: [],
  riskSignals: [],
  missingSignals: [],
});

test("runMonitoringForSource skips known URLs and duplicates, sinks discards and creates companies for real leads", async () => {
  const persisted: PersistableLead[] = [];
  const events: MonitoringStreamEvent[] = [];
  const touched: string[][] = [];
  const runs: unknown[] = [];
  const { resolver, resolved } = fakeResolver();
  const feed = [
    job(1), // new, interesting
    job(2), // known URL
    job(3, { title: "Already Seen Elsewhere" }), // same vacancy already in the database
    job(4, { title: "Backend Engineer 1", companyName: "Company 1" }), // same key as job 1 in this run
    job(5), // hard-filter rejection
    job(6), // classifier discards
    job(7), // review
  ];

  const summary = await runMonitoringForSource(source, context, {
    fetchSourceFn: async () => ({ jobs: feed, cursor: "200" }),
    existingUrlsFn: (urls) => new Set(urls.filter((url) => url.endsWith("/2"))),
    touchUrlsFn: (urls) => touched.push(urls),
    findLeadByDedupKeyFn: (key) =>
      key === buildDedupKey("Company 3", "Already Seen Elsewhere")
        ? { id: 55, companyId: 3, sourceKind: "company", sourceUrl: "https://ats.example/3" }
        : null,
    recordRunFn: (id, outcome) => runs.push([id, outcome]),
    resolver,
    triageJobFn: async (candidate) => {
      // Stage 0 rejection: no model, score 0, engine "rules".
      if (candidate.sourceUrl.endsWith("/5")) {
        return {
          classification: { ...classification("discarded"), score: 0, reason: "Título fora das famílias alvo" },
          fields: { ...emptyTriageFields("rules"), discardReason: "job_family_mismatch" },
        };
      }

      return classificationToTriageResult(
        classification(
          candidate.title?.endsWith(" 6") ? "discarded" : candidate.title?.endsWith(" 7") ? "review" : "interesting",
        ),
      );
    },
    upsertJobLeadFn: (lead) => {
      persisted.push(lead);
      return { id: persisted.length, created: true, promotedToApplicationId: null, leadSnapshot: snapshot(lead) };
    },
    onEvent: (event) => events.push(event),
  });

  assert.deepEqual(summary, {
    linksFound: 7,
    skippedLinks: 3, // known URL + database duplicate + in-run duplicate
    jobsParsed: 2,
    leadsSaved: 2,
    reviewsSaved: 1,
    discarded: 2,
    failed: 0,
  });
  assert.equal(events.filter((event) => event.type === "link-skipped").length, 3);
  assert.equal(events.filter((event) => event.type === "link-done").length, 4);
  assert.deepEqual(touched, [["https://feed.example/jobs/2"]]);

  const byUrl = new Map(persisted.map((lead) => [lead.sourceUrl, lead]));
  assert.equal(persisted.length, 4);

  const first = byUrl.get("https://feed.example/jobs/1")!;
  assert.equal(first.sourceKind, "himalayas");
  assert.equal(first.sourceName, "himalayas");
  assert.equal(first.externalId, "job-1");
  assert.equal(first.workModel, "remote");
  assert.equal(first.salaryText, "USD 5,000-6,000 / month");
  assert.match(first.dedupKey ?? "", /^[a-f0-9]{32}$/);
  assert.ok(first.companyId >= 100 && first.companyId !== 999);

  // Hard-filter rejection and classifier discard both live under the sink company.
  assert.equal(byUrl.get("https://feed.example/jobs/5")!.companyId, 999);
  assert.equal(byUrl.get("https://feed.example/jobs/5")!.classificationScore, 0);
  assert.equal(byUrl.get("https://feed.example/jobs/5")!.classificationReason, "Título fora das famílias alvo");
  assert.equal(byUrl.get("https://feed.example/jobs/5")!.discardReason, "job_family_mismatch");
  assert.equal(byUrl.get("https://feed.example/jobs/5")!.triageEngine, "rules");
  assert.equal(byUrl.get("https://feed.example/jobs/6")!.companyId, 999);
  // Only vacancies worth a look created companies.
  assert.deepEqual(resolved.sort(), ["Company 1", "Company 7"]);

  // The run completed: the source's cursor advances.
  assert.deepEqual(runs, [[7, { ok: true, cursor: "200" }]]);
});

test("runMonitoringForSource keeps the old cursor when a job fails and records fetch errors", async () => {
  const runs: unknown[] = [];
  const { resolver } = fakeResolver();

  const summary = await runMonitoringForSource(source, context, {
    fetchSourceFn: async () => ({ jobs: [job(1), job(2)], cursor: "300" }),
    existingUrlsFn: () => new Set(),
    touchUrlsFn: () => undefined,
    findLeadByDedupKeyFn: () => null,
    recordRunFn: (id, outcome) => runs.push([id, outcome]),
    resolver,
    classifyJobLeadFn: async (detail) => {
      if (detail.title?.endsWith(" 2")) {
        throw new Error("modelo fora do ar");
      }

      return classification("interesting");
    },
    upsertJobLeadFn: (lead) => ({
      id: 1,
      created: true,
      promotedToApplicationId: null,
      leadSnapshot: snapshot(lead),
    }),
  });

  assert.equal(summary.failed, 1);
  assert.equal(summary.leadsSaved, 1);
  // A failed job must come back on the next run: no cursor in the outcome.
  assert.deepEqual(runs, [[7, { ok: true }]]);

  const failedRuns: unknown[] = [];

  await assert.rejects(
    runMonitoringForSource(source, context, {
      fetchSourceFn: async () => {
        throw new Error("HTTP 503 em himalayas.app");
      },
      recordRunFn: (id, outcome) => failedRuns.push([id, outcome]),
    }),
    /HTTP 503/,
  );
  assert.deepEqual(failedRuns, [[7, { ok: false, error: "HTTP 503 em himalayas.app" }]]);
});

test("runMonitoringForSource stops processing when the run is cancelled", async () => {
  const controller = new AbortController();
  const { resolver } = fakeResolver();
  const persisted: PersistableLead[] = [];
  const runs: unknown[] = [];

  await runMonitoringForSource(source, context, {
    fetchSourceFn: async () => ({ jobs: [job(1), job(2), job(3)], cursor: "400" }),
    existingUrlsFn: () => new Set(),
    touchUrlsFn: () => undefined,
    findLeadByDedupKeyFn: () => null,
    recordRunFn: (id, outcome) => runs.push([id, outcome]),
    resolver,
    classifyJobLeadFn: async () => {
      controller.abort();
      return classification("interesting");
    },
    upsertJobLeadFn: (lead) => {
      persisted.push(lead);
      return { id: 1, created: true, promotedToApplicationId: null, leadSnapshot: snapshot(lead) };
    },
    signal: controller.signal,
  });

  // The first five run concurrently; with concurrency 5 all three start before the abort lands,
  // so what matters is that the cursor is not advanced for an aborted run.
  assert.ok(persisted.length >= 1);
  assert.deepEqual(runs, [[7, { ok: true }]]);
});
