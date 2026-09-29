import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSearchPreferences } from "@/lib/search-preferences";

import {
  acceptedLocationTerms,
  findRestrictiveLocationPhrase,
  hardFilters,
  utcOffsetHours,
} from "./hard-filters";
import type { TriageJob } from "./types";

function job(overrides: Partial<TriageJob> = {}): TriageJob {
  return {
    title: "Senior Backend Engineer",
    description: "Build APIs.",
    sourceUrl: "https://example.test/jobs/1",
    sourceName: "himalayas",
    workModel: "remote",
    seniority: null,
    locationText: "Remote",
    salaryText: null,
    ...overrides,
  };
}

const prefs = normalizeSearchPreferences({
  minMonthlyUsd: 5000,
  acceptedEligibility: ["worldwide", "latam", "brazil"],
  targetJobFamilies: ["backend", "fullstack"],
  titleIncludeKeywords: ["engineer"],
  titleExcludeKeywords: ["intern", "sales"],
  timezone: "America/Sao_Paulo",
  maxUtcOffsetDistanceHours: 4,
});

test("no preferences means every filter is off", () => {
  const result = hardFilters(job({ title: "Sales Intern", description: "US only" }), null);

  assert.equal(result.pass, true);
});

test("title: exclude keywords and missing include/family keywords discard as job_family_mismatch", () => {
  const excluded = hardFilters(job({ title: "Sales Engineer" }), prefs);
  assert.deepEqual([excluded.pass, !excluded.pass && excluded.reason], [false, "job_family_mismatch"]);
  assert.match(!excluded.pass ? excluded.detail : "", /"sales"/);

  const offTopic = hardFilters(job({ title: "Head of Marketing" }), prefs);
  assert.deepEqual([offTopic.pass, !offTopic.pass && offTopic.reason], [false, "job_family_mismatch"]);

  assert.equal(hardFilters(job({ title: "Backend Developer (Node.js)" }), prefs).pass, true);
  assert.equal(hardFilters(job({ title: "Full-Stack Engineer" }), prefs).pass, true);
  // A generic developer title is left for the model to place in a family.
  assert.equal(hardFilters(job({ title: "Software Developer II" }), prefs).pass, true);
  // "intern" is excluded on a word boundary, not as a substring of "international".
  assert.equal(hardFilters(job({ title: "International Backend Engineer" }), prefs).pass, true);
});

test("title filters are off when neither keywords nor families are set", () => {
  const onlyLocation = normalizeSearchPreferences({ acceptedEligibility: ["worldwide"] });

  assert.equal(hardFilters(job({ title: "Head of Marketing" }), onlyLocation).pass, true);
});

test("structured location restrictions must include an accepted region", () => {
  const usOnly = hardFilters(job({ locationRestrictions: ["United States"] }), prefs);
  assert.deepEqual([usOnly.pass, !usOnly.pass && usOnly.reason], [false, "location_ineligible"]);

  assert.equal(hardFilters(job({ locationRestrictions: ["Brazil", "Argentina"] }), prefs).pass, true);
  assert.equal(hardFilters(job({ locationRestrictions: ["LATAM"] }), prefs).pass, true);
  assert.equal(hardFilters(job({ locationRestrictions: ["Anywhere in the World"] }), prefs).pass, true);
  assert.equal(hardFilters(job({ locationRestrictions: ["Germany", "France"] }), prefs).pass, false);
  assert.equal(hardFilters(job({ locationRestrictions: [] }), prefs).pass, true);

  const brazilOnly = normalizeSearchPreferences({ acceptedEligibility: ["brazil"] });
  assert.equal(hardFilters(job({ locationRestrictions: ["Argentina"] }), brazilOnly).pass, false);
  assert.equal(hardFilters(job({ locationRestrictions: ["Brasil"] }), brazilOnly).pass, true);
});

test("restrictive phrases in the text are caught with high precision", () => {
  for (const text of [
    "This role is US only.",
    "US-only role",
    "Candidates must be located in the United States.",
    "You must reside in the US to apply.",
    "Applicants must be authorized to work in the United States without sponsorship.",
    "We are hiring in the EU only.",
    "UK only",
    "Canada only",
    "Europe only",
  ]) {
    const result = hardFilters(job({ description: text }), prefs);
    assert.equal(result.pass, false, text);
    assert.equal(!result.pass && result.reason, "location_ineligible", text);
  }

  for (const text of [
    "Remote (US) or anywhere",
    "This is not US only, we hire globally.",
    "Non-EU only? No, we hire everywhere.",
    "You may be authorized to work in the United States or elsewhere; we offer visa sponsorship.",
    "Our customers are in the US.",
    "Work from anywhere in the Americas",
  ]) {
    assert.equal(hardFilters(job({ description: text }), prefs).pass, true, text);
  }

  assert.equal(findRestrictiveLocationPhrase("plain description"), null);
});

test("phrase and structured location checks are off without accepted regions", () => {
  const noRegions = normalizeSearchPreferences({ minMonthlyUsd: 1000 });

  assert.equal(hardFilters(job({ description: "US only", locationRestrictions: ["United States"] }), noRegions).pass, true);
});

test("timezone restrictions are compared with the configured offset distance", () => {
  const now = new Date("2026-06-15T12:00:00Z"); // Sao Paulo is UTC-3 all year
  assert.equal(utcOffsetHours("America/Sao_Paulo", now), -3);
  assert.equal(utcOffsetHours("UTC", now), 0);
  assert.equal(utcOffsetHours("Asia/Kolkata", now), 5.5);
  assert.equal(utcOffsetHours("Not/AZone", now), null);

  const europe = hardFilters(job({ timezoneRestrictions: [2, 3, 8] }), prefs, { now });
  assert.deepEqual([europe.pass, !europe.pass && europe.reason], [false, "location_ineligible"]);

  assert.equal(hardFilters(job({ timezoneRestrictions: [-8, -5, -3] }), prefs, { now }).pass, true);
  assert.equal(hardFilters(job({ timezoneRestrictions: [] }), prefs, { now }).pass, true);
});

test("salary: only a known USD figure below the floor discards", () => {
  // Floor = 5000 * 12 = 60000/year.
  const low = hardFilters(job({ salaryText: "USD 3,000-4,000 / month" }), prefs);
  assert.deepEqual([low.pass, !low.pass && low.reason], [false, "salary_below_min"]);
  assert.deepEqual(low.salary, { min: 36000, max: 48000 });

  const hourly = hardFilters(job({ salaryText: "USD 20-25 / hour" }), prefs);
  assert.equal(hourly.pass, false); // 25 * 2080 = 52000

  const structured = hardFilters(job({ salary: { min: 2000, max: 2500, currency: "USD", period: "month" } }), prefs);
  assert.equal(structured.pass, false);

  const enough = hardFilters(job({ salaryText: "$140K - $180K" }), prefs);
  assert.equal(enough.pass, true);
  assert.deepEqual(enough.salary, { min: 140000, max: 180000 });

  // The maximum decides: a range that reaches the floor passes.
  assert.equal(hardFilters(job({ salaryText: "USD 4,000-6,000 / month" }), prefs).pass, true);
  // Other currencies never discard.
  assert.equal(hardFilters(job({ salaryText: "EUR 20,000-30,000 / year" }), prefs).pass, true);
  assert.equal(hardFilters(job({ salaryText: "R$ 2.000 / mes" }), prefs).pass, true);
  // Unknown period on a small figure is ambiguous: keep it.
  assert.equal(hardFilters(job({ salaryText: "USD 3,000" }), prefs).pass, true);
});

test("the discard order is title, then location, then salary", () => {
  const everything = hardFilters(
    job({ title: "Sales Manager", locationRestrictions: ["United States"], salaryText: "USD 1,000 / month" }),
    prefs,
  );
  assert.equal(!everything.pass && everything.reason, "job_family_mismatch");

  const locationAndSalary = hardFilters(
    job({ locationRestrictions: ["United States"], salaryText: "USD 1,000 / month" }),
    prefs,
  );
  assert.equal(!locationAndSalary.pass && locationAndSalary.reason, "location_ineligible");
});

test("acceptedLocationTerms merges the terms of each scope", () => {
  assert.ok(acceptedLocationTerms(["worldwide"]).includes("anywhere"));
  assert.ok(acceptedLocationTerms(["brazil"]).includes("brasil"));
  assert.ok(!acceptedLocationTerms(["brazil"]).includes("argentina"));
  assert.ok(acceptedLocationTerms(["latam"]).includes("argentina"));
  assert.deepEqual(acceptedLocationTerms([]), []);
});
