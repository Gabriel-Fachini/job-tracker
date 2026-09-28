import assert from "node:assert/strict";
import test from "node:test";

import {
  getAnnualSalaryFloorUsd,
  hasActiveSearchFilters,
  normalizeKeywordList,
  normalizeSearchPreferences,
  searchPreferencesFromRow,
} from "./search-preferences";
import { getSearchPreferences, saveSearchPreferences } from "./search-preferences-queries";

test("normalizeKeywordList splits, lowercases, trims and dedupes", () => {
  assert.deepEqual(normalizeKeywordList("Backend, ENGINEER ,backend\n  full   stack "), [
    "backend",
    "engineer",
    "full stack",
  ]);
  assert.deepEqual(normalizeKeywordList(["A", " a ", 3]), ["a"]);
  assert.deepEqual(normalizeKeywordList(undefined), []);
});

test("normalizeSearchPreferences keeps only allowed enum values and clamps numbers", () => {
  const result = normalizeSearchPreferences({
    minMonthlyUsd: "5000",
    minAnnualUsd: -1,
    acceptedContracts: ["contractor", "slave", "eor", "eor"],
    acceptedEligibility: ["latam", "mars"],
    timezone: "America/Sao_Paulo",
    maxUtcOffsetDistanceHours: 99,
    targetSeniorities: ["senior", "wizard"],
    targetJobFamilies: ["backend", "ai_ml", "cook"],
    titleIncludeKeywords: "Engineer, Developer",
    titleExcludeKeywords: ["Intern"],
    defaultAnswers: { notice_period: " 30 days ", unknown_key: "x", pronouns: "  " },
  });

  assert.equal(result.minMonthlyUsd, 5000);
  assert.equal(result.minAnnualUsd, null);
  assert.deepEqual(result.acceptedContracts, ["contractor", "eor"]);
  assert.deepEqual(result.acceptedEligibility, ["latam"]);
  assert.equal(result.timezone, "America/Sao_Paulo");
  assert.equal(result.maxUtcOffsetDistanceHours, 12);
  assert.deepEqual(result.targetSeniorities, ["senior"]);
  assert.deepEqual(result.targetJobFamilies, ["backend", "ai_ml"]);
  assert.deepEqual(result.titleIncludeKeywords, ["engineer", "developer"]);
  assert.deepEqual(result.titleExcludeKeywords, ["intern"]);
  assert.deepEqual(result.defaultAnswers, { notice_period: "30 days" });
});

test("normalizeSearchPreferences drops unknown time zones and tolerates garbage", () => {
  assert.equal(normalizeSearchPreferences({ timezone: "Not/AZone" }).timezone, null);
  const empty = normalizeSearchPreferences(null);
  assert.equal(empty.minAnnualUsd, null);
  assert.deepEqual(empty.acceptedContracts, []);
});

test("getAnnualSalaryFloorUsd compares monthly x 12 with annual and takes the lower floor", () => {
  assert.equal(getAnnualSalaryFloorUsd(null), null);
  assert.equal(getAnnualSalaryFloorUsd({ minMonthlyUsd: null, minAnnualUsd: null }), null);
  assert.equal(getAnnualSalaryFloorUsd({ minMonthlyUsd: 5000, minAnnualUsd: null }), 60000);
  assert.equal(getAnnualSalaryFloorUsd({ minMonthlyUsd: null, minAnnualUsd: 90000 }), 90000);
  assert.equal(getAnnualSalaryFloorUsd({ minMonthlyUsd: 5000, minAnnualUsd: 90000 }), 60000);
  assert.equal(getAnnualSalaryFloorUsd({ minMonthlyUsd: 10000, minAnnualUsd: 90000 }), 90000);
});

test("hasActiveSearchFilters is false without preferences or with an empty one", () => {
  assert.equal(hasActiveSearchFilters(null), false);
  assert.equal(hasActiveSearchFilters(normalizeSearchPreferences({})), false);
  assert.equal(
    hasActiveSearchFilters(normalizeSearchPreferences({ titleExcludeKeywords: ["intern"] })),
    true,
  );
});

test("searchPreferencesFromRow tolerates broken JSON columns", () => {
  const preferences = searchPreferencesFromRow({
    minMonthlyUsd: 4000,
    minAnnualUsd: null,
    acceptedContracts: "not json",
    acceptedEligibility: '["worldwide"]',
    timezone: null,
    maxUtcOffsetDistanceHours: null,
    targetSeniorities: null,
    targetJobFamilies: "[]",
    titleIncludeKeywords: '["engineer"]',
    titleExcludeKeywords: null,
    defaultAnswers: '{"notice_period":"2 weeks"}',
    updatedAt: new Date(0),
  });

  assert.deepEqual(preferences.acceptedContracts, []);
  assert.deepEqual(preferences.acceptedEligibility, ["worldwide"]);
  assert.deepEqual(preferences.titleIncludeKeywords, ["engineer"]);
  assert.deepEqual(preferences.defaultAnswers, { notice_period: "2 weeks" });
});

test("saveSearchPreferences keeps a single row and getSearchPreferences reads it back", () => {
  // Runs against the schema-only test database created by `pretest`.
  assert.equal(getSearchPreferences(), null);

  saveSearchPreferences(normalizeSearchPreferences({ minMonthlyUsd: 1000, acceptedContracts: ["pj"] }));
  const second = saveSearchPreferences(
    normalizeSearchPreferences({ minMonthlyUsd: 2000, acceptedContracts: ["eor"] }),
  );

  assert.equal(second.minMonthlyUsd, 2000);
  assert.deepEqual(second.acceptedContracts, ["eor"]);
  assert.equal(getSearchPreferences()?.minMonthlyUsd, 2000);
});
