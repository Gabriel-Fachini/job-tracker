import assert from "node:assert/strict";
import test from "node:test";

import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { mapRawLeadToListItem } from "@/lib/job-leads/mapper";
import {
  median,
  summarizeInternationalRadar,
} from "@/server/queries/international-radar";

import { formatDismissedExample } from "./feedback";
import { upsertJobLead } from "./persistence";
import { triageFieldsToLead } from "./triage/adapter";
import { getDiscardReasonLabel, isUserDiscardReason } from "./triage/discard-reasons";
import {
  formatContractTypes,
  formatUsdAnnualBounds,
  getEligibilityLabel,
} from "./triage/labels";
import { emptyTriageFields } from "./triage/types";

test("triage fields are stored on the lead and come back mapped for the UI", () => {
  const now = new Date();
  const companyId = db
    .insert(companies)
    .values({ name: "Triage Persist Co", status: "monitoring", origin: "aggregator", radarEnabled: false, createdAt: now, updatedAt: now })
    .returning({ id: companies.id })
    .get().id;
  const fields = {
    ...emptyTriageFields("openai"),
    eligibility: "americas_or_latam_incl_brazil",
    contractTypes: ["contractor", "eor"],
    salaryMinUsdAnnual: 140000,
    salaryMaxUsdAnnual: 160000,
    triageModel: "gpt-6-luna",
    triageConfidence: 0.8,
    triageDetails: { stage: 2, note: "ok" },
  };

  const result = upsertJobLead({
    companyId,
    title: "Backend Engineer",
    sourceUrl: "https://triage-persist.example/jobs/1",
    sourceName: "himalayas",
    description: "d",
    workModel: "remote",
    seniority: null,
    locationText: null,
    salaryText: null,
    classificationStatus: "interesting",
    classificationScore: 82,
    classificationReason: "ok",
    ...triageFieldsToLead(fields),
  });

  assert.equal(result.leadSnapshot.eligibility, "americas_or_latam_incl_brazil");
  assert.deepEqual(result.leadSnapshot.contractTypes, ["contractor", "eor"]);
  assert.equal(result.leadSnapshot.salaryMinUsdAnnual, 140000);
  assert.equal(result.leadSnapshot.triageEngine, "openai");
  assert.equal(result.leadSnapshot.discardReason, null);

  const row = db.select().from(jobLeads).all().find((lead) => lead.id === result.id)!;
  assert.equal(row.triageModel, "gpt-6-luna");
  assert.equal(row.triageConfidence, 0.8);
  assert.deepEqual(JSON.parse(row.triageDetails ?? "{}"), { stage: 2, note: "ok" });
  assert.equal(row.userDiscardReason, null);
});

test("mapRawLeadToListItem tolerates broken contract JSON", () => {
  const base = {
    id: 1, title: "t", sourceUrl: "u", sourceName: "s", sourceKind: null, applyUrl: null, description: null,
    workModel: null, seniority: null, locationText: null, salaryText: null, classificationStatus: "review",
    classificationScore: 1, classificationReason: null, eligibility: null, salaryMinUsdAnnual: null,
    salaryMaxUsdAnnual: null, discardReason: null, triageEngine: null, userDecision: "none",
    promotedToApplicationId: null, discoveredAt: new Date(), updatedAt: new Date(), companyId: 1, companyName: "c",
  };

  assert.deepEqual(mapRawLeadToListItem({ ...base, contractTypes: "not json" }).contractTypes, []);
  assert.deepEqual(mapRawLeadToListItem({ ...base, contractTypes: null }).contractTypes, []);
  assert.deepEqual(mapRawLeadToListItem({ ...base, contractTypes: '["employee",3]' }).contractTypes, ["employee"]);
});

test("manual discard reasons feed the classifier feedback", () => {
  assert.equal(
    formatDismissedExample({ title: "Data Engineer", companyName: "Acme", reason: "Pouco aderente", userDiscardReason: "salary_below_min" }),
    "Data Engineer em Acme: descartada pelo usuário (salário abaixo do mínimo)",
  );
  assert.equal(
    formatDismissedExample({ title: "Data Engineer", companyName: "Acme", reason: "Pouco aderente", userDiscardReason: null }),
    "Data Engineer em Acme: Pouco aderente",
  );
  assert.equal(
    formatDismissedExample({ title: "Data Engineer", companyName: "Acme", reason: null, userDiscardReason: "invalid" }),
    "Data Engineer em Acme",
  );
  assert.equal(isUserDiscardReason("not_interested"), true);
  assert.equal(isUserDiscardReason("nope"), false);
  assert.equal(getDiscardReasonLabel("low_fit"), "Pouco aderente ao perfil");
});

test("labels format the triage vocabulary in pt-BR", () => {
  assert.equal(getEligibilityLabel("worldwide"), "mundo todo");
  assert.equal(getEligibilityLabel(null), null);
  assert.equal(formatContractTypes(["contractor", "eor"]), "contractor, EOR");
  assert.equal(formatContractTypes([]), null);
  assert.equal(formatUsdAnnualBounds(120000, 150000), "US$ 120–150 mil/ano");
  assert.equal(formatUsdAnnualBounds(null, 96000), "US$ 96 mil/ano");
  assert.equal(formatUsdAnnualBounds(null, null), null);
});

test("the international radar panel summarizes sources, discard reasons, eligibility and median salary", () => {
  const data = summarizeInternationalRadar([
    { sourceKind: "himalayas", discardReason: null, salaryMinUsdAnnual: 100000, salaryMaxUsdAnnual: 120000 },
    { sourceKind: "himalayas", discardReason: "location_ineligible", salaryMinUsdAnnual: 90000, salaryMaxUsdAnnual: 90000 },
    { sourceKind: "remoteok", discardReason: "salary_below_min", salaryMinUsdAnnual: 30000, salaryMaxUsdAnnual: 30000 },
    { sourceKind: "company", discardReason: null, salaryMinUsdAnnual: 200000, salaryMaxUsdAnnual: null },
    { sourceKind: null, discardReason: null, salaryMinUsdAnnual: null, salaryMaxUsdAnnual: null },
  ]);

  assert.equal(data.total, 5);
  // 4 of 5 are not discarded for location.
  assert.equal(data.eligiblePct, 80);
  assert.deepEqual(data.bySource[0], { source: "himalayas", count: 2 });
  assert.deepEqual(data.discardReasons.map((row) => row.reason).sort(), ["location_ineligible", "salary_below_min"]);
  // Eligible midpoints: 110k, 30k, 200k -> median 110k (the location-ineligible 90k is excluded).
  assert.equal(data.medianSalaryUsdAnnual, 110000);
  assert.equal(data.salarySamples, 3);

  const empty = summarizeInternationalRadar([]);
  assert.equal(empty.eligiblePct, null);
  assert.equal(empty.medianSalaryUsdAnnual, null);
  assert.equal(median([1, 2, 3, 4]), 3);
  assert.equal(median([]), null);
});
