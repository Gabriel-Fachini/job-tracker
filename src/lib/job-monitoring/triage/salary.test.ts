import assert from "node:assert/strict";
import test from "node:test";

import {
  extractSalaryCandidates,
  formatAnnualUsdRange,
  parseSalaryText,
  toAnnualUsd,
  toAnnualUsdFromStructured,
} from "./salary";

test("parseSalaryText reads ranges, k units, currency codes and periods", () => {
  assert.deepEqual(parseSalaryText("$140K - $180K"), { min: 140000, max: 180000, currency: "USD", period: null });
  assert.deepEqual(parseSalaryText("USD 150,000-190,000 / year"), { min: 150000, max: 190000, currency: "USD", period: "year" });
  assert.deepEqual(parseSalaryText("USD 80-95 / hour"), { min: 80, max: 95, currency: "USD", period: "hour" });
  assert.deepEqual(parseSalaryText("USD 8,000 per month"), { min: 8000, max: 8000, currency: "USD", period: "month" });
  assert.deepEqual(parseSalaryText("€110K - €185K"), { min: 110000, max: 185000, currency: "EUR", period: null });
  assert.deepEqual(parseSalaryText("120-150k USD"), { min: 120000, max: 150000, currency: "USD", period: null });
  assert.deepEqual(parseSalaryText("R$ 12.000 / mes"), { min: 12000, max: 12000, currency: "BRL", period: null });
  assert.deepEqual(parseSalaryText("CAD 90,000 - 110,000 annually"), { min: 90000, max: 110000, currency: "CAD", period: "year" });
  assert.deepEqual(parseSalaryText("CA$100k"), { min: 100000, max: 100000, currency: "CAD", period: null });
  assert.equal(parseSalaryText(null), null);
  assert.equal(parseSalaryText("Competitive salary"), null);
  assert.equal(parseSalaryText("5 years of experience"), null);
});

test("toAnnualUsd normalizes periods and refuses non-USD or ambiguous figures", () => {
  assert.deepEqual(toAnnualUsd(parseSalaryText("$140K - $180K")), { min: 140000, max: 180000 });
  assert.deepEqual(toAnnualUsd(parseSalaryText("USD 8,000 per month")), { min: 96000, max: 96000 });
  assert.deepEqual(toAnnualUsd(parseSalaryText("USD 50 / hour")), { min: 104000, max: 104000 });
  assert.deepEqual(toAnnualUsd({ min: 2000, max: 2000, currency: "USD", period: "week" }), { min: 104000, max: 104000 });
  assert.equal(toAnnualUsd(parseSalaryText("EUR 100,000 / year")), null);
  assert.equal(toAnnualUsd(parseSalaryText("USD 5,000")), null);
  assert.equal(toAnnualUsd({ min: null, max: null, currency: "USD", period: "year" }), null);
  assert.equal(toAnnualUsd(null), null);
});

test("toAnnualUsdFromStructured handles source-provided numbers", () => {
  assert.deepEqual(toAnnualUsdFromStructured({ min: 5000, max: 7000, currency: "usd", period: "month" }), { min: 60000, max: 84000 });
  assert.deepEqual(toAnnualUsdFromStructured({ min: 120000, currency: "USD", period: "year" }), { min: 120000, max: 120000 });
  assert.equal(toAnnualUsdFromStructured({ min: 5000, currency: "EUR", period: "month" }), null);
  assert.equal(toAnnualUsdFromStructured({ min: 5000, period: "month" }), null);
  assert.equal(toAnnualUsdFromStructured(undefined), null);
});

test("extractSalaryCandidates finds figures with a currency, unit or period and skips bare numbers", () => {
  const description = [
    "We have 25 years of history and 300 employees.",
    "Base salary: $120k–$150k depending on experience.",
    "Annual bonus of up to $20,000 and equity.",
    "Contractors are paid USD 8,000/month.",
    "Base salary: $120k–$150k (repeated).",
  ].join("\n");

  const candidates = extractSalaryCandidates(description);

  assert.deepEqual(
    candidates.map((candidate) => [candidate.id, candidate.parsed.min, candidate.parsed.max, candidate.parsed.period]),
    [
      ["c1", 120000, 150000, null],
      ["c2", 20000, 20000, null],
      ["c3", 8000, 8000, "month"],
    ],
  );
  assert.match(candidates[0].context, /Base salary/);
  assert.match(candidates[1].context, /bonus/);
  assert.deepEqual(extractSalaryCandidates(""), []);
  assert.deepEqual(extractSalaryCandidates("No numbers here"), []);
  assert.equal(extractSalaryCandidates(description, 2).length, 2);
});

test("formatAnnualUsdRange writes pt-BR ranges", () => {
  assert.equal(formatAnnualUsdRange({ min: 120000, max: 150000 }), "US$ 120–150 mil/ano");
  assert.equal(formatAnnualUsdRange({ min: 96000, max: 96000 }), "US$ 96 mil/ano");
  assert.equal(formatAnnualUsdRange({ min: 62500, max: 62500 }), "US$ 62,5 mil/ano");
});
