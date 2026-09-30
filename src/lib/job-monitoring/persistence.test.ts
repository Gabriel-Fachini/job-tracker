import assert from "node:assert/strict";
import test from "node:test";

import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { createCompanyResolver } from "@/lib/companies/resolve";
import { DISCARDED_SINK_COMPANY_NAME } from "@/lib/companies/company-origin";

import {
  adoptAtsLink,
  DEDUP_WINDOW_DAYS,
  findLeadByDedupKey,
  getExistingLeadUrlsAnyCompany,
  upsertJobLead,
} from "./persistence";
import { ensureDefaultSources, listSources, recordSourceRun, setSourceEnabled } from "./sources/store";

// These tests write to the schema-only database `npm test` creates (tmp/test.db).
// Names and URLs are unique to this file so parallel test files do not collide.

function insertCompany(name: string) {
  const now = new Date();

  return db
    .insert(companies)
    .values({ name, status: "monitoring", origin: "aggregator", radarEnabled: false, createdAt: now, updatedAt: now })
    .returning({ id: companies.id })
    .get().id;
}

const baseLead = {
  description: "desc",
  workModel: "remote",
  seniority: null,
  locationText: "Remote",
  salaryText: null,
  classificationStatus: "review" as const,
  classificationScore: 50,
  classificationReason: "ok",
};

test("upsertJobLead stores source fields and findLeadByDedupKey respects the 60-day window", () => {
  const companyId = insertCompany("Persist Test Co");
  const dedupKey = "persist-test-key-1";

  const created = upsertJobLead({
    ...baseLead,
    companyId,
    title: "Backend Engineer",
    sourceUrl: "https://persist-test.example/jobs/1",
    sourceName: "himalayas",
    sourceKind: "himalayas",
    externalId: "ext-1",
    applyUrl: "https://persist-test.example/apply/1",
    dedupKey,
  });

  assert.equal(created.created, true);
  assert.equal(created.leadSnapshot.sourceKind, "himalayas");
  assert.equal(created.leadSnapshot.applyUrl, "https://persist-test.example/apply/1");

  const match = findLeadByDedupKey(dedupKey);
  assert.equal(match?.id, created.id);
  assert.equal(match?.sourceKind, "himalayas");
  assert.equal(findLeadByDedupKey("persist-test-unknown-key"), null);

  const future = new Date(Date.now() + (DEDUP_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000);
  assert.equal(findLeadByDedupKey(dedupKey, future), null);

  // Re-upserting the same URL updates instead of inserting.
  const again = upsertJobLead({
    ...baseLead,
    companyId,
    title: "Backend Engineer (updated)",
    sourceUrl: "https://persist-test.example/jobs/1",
    sourceName: "himalayas",
    sourceKind: "himalayas",
    dedupKey,
  });
  assert.equal(again.created, false);
  assert.equal(again.id, created.id);
});

test("adoptAtsLink points an aggregator lead at the ATS page", () => {
  const companyId = insertCompany("Adopt Test Co");
  const created = upsertJobLead({
    ...baseLead,
    companyId,
    title: "Data Engineer",
    sourceUrl: "https://adopt-test.example/agg/1",
    sourceName: "remoteok",
    sourceKind: "remoteok",
    dedupKey: "adopt-test-key",
  });

  assert.equal(
    adoptAtsLink(created.id, {
      sourceUrl: "https://jobs.ashbyhq.com/adopt-test/abc",
      sourceName: "ashby",
      applyUrl: "https://jobs.ashbyhq.com/adopt-test/abc/application",
      externalId: "abc",
    }),
    true,
  );

  const urls = getExistingLeadUrlsAnyCompany([
    "https://jobs.ashbyhq.com/adopt-test/abc",
    "https://adopt-test.example/agg/1",
  ]);
  assert.deepEqual([...urls], ["https://jobs.ashbyhq.com/adopt-test/abc"]);

  const row = db.select().from(jobLeads).all().find((lead) => lead.id === created.id)!;
  assert.equal(row.sourceKind, "company");
  assert.equal(row.applyUrl, "https://jobs.ashbyhq.com/adopt-test/abc/application");
  assert.equal(row.dedupKey, "adopt-test-key");
});

test("createCompanyResolver reuses companies by name and creates aggregator ones with the radar off", () => {
  const existingId = insertCompany("Resolver Existing Inc");
  const resolver = createCompanyResolver();

  assert.deepEqual(resolver.resolve({ name: "RESOLVER EXISTING, LLC" }), { id: existingId, created: false });

  const created = resolver.resolve({ name: "Resolver Brand New Co", website: "https://resolver-new.example/careers" });
  assert.equal(created.created, true);

  const row = db.select().from(companies).all().find((company) => company.id === created.id)!;
  assert.equal(row.origin, "aggregator");
  assert.equal(row.radarEnabled, false);
  assert.equal(row.status, "monitoring");
  assert.equal(row.website, "https://resolver-new.example");
  assert.equal(row.jobsBoardUrl, null);

  assert.deepEqual(resolver.resolve({ name: "resolver brand new" }), { id: created.id, created: false });

  const sinkId = resolver.discardedSinkId();
  assert.equal(createCompanyResolver().discardedSinkId(), sinkId);
  const sink = db.select().from(companies).all().find((company) => company.id === sinkId)!;
  assert.equal(sink.name, DISCARDED_SINK_COMPANY_NAME);
  assert.equal(sink.status, "discarded");
});

test("job sources are seeded once, toggled and record run outcomes", () => {
  ensureDefaultSources();
  ensureDefaultSources();

  const sources = listSources();
  assert.deepEqual(
    sources.map((source) => source.kind),
    ["himalayas", "remoteok", "weworkremotely", "jobicy", "hn_whoishiring"],
  );
  assert.ok(sources.every((source) => source.enabled));

  const himalayas = sources[0];
  assert.equal(setSourceEnabled(himalayas.id, false), true);
  assert.equal(listSources()[0].enabled, false);
  assert.equal(setSourceEnabled(9999, true), false);

  recordSourceRun(himalayas.id, { ok: true, cursor: "123" });
  let updated = listSources()[0];
  assert.equal(updated.lastCursor, "123");
  assert.equal(updated.lastError, null);
  assert.ok(updated.lastRunAt);

  recordSourceRun(himalayas.id, { ok: false, error: "HTTP 500" });
  updated = listSources()[0];
  assert.equal(updated.lastError, "HTTP 500");
  // A failed run keeps the cursor.
  assert.equal(updated.lastCursor, "123");

  recordSourceRun(himalayas.id, { ok: true });
  assert.equal(listSources()[0].lastCursor, "123");
  assert.equal(listSources()[0].lastError, null);
});
