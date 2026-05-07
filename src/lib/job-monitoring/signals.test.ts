import assert from "node:assert/strict";
import test from "node:test";

import {
  extractJobSignals,
  normalizeBrazilianJobText,
} from "./signals";

test("normalizeBrazilianJobText remove acentos e colapsa whitespace", () => {
  assert.equal(
    normalizeBrazilianJobText("Sênior   Híbrido  São Paulo"),
    "senior hibrido sao paulo",
  );
});

test("extractJobSignals identifica sinais brasileiros relevantes", () => {
  const result = extractJobSignals({
    title: "Pessoa Engenheira de Software Sênior",
    description:
      "Vaga remota no Brasil em regime CLT para atuar com React, TypeScript e Node.js. Híbrido em São Paulo quando necessário.",
    sourceUrl: "https://example.com/jobs/123",
    sourceName: "company_site",
    workModel: null,
    seniority: null,
    locationText: "São Paulo, SP, Brasil",
    salaryText: null,
  });

  assert.equal(result.detectedSeniority, "senior");
  assert.deepEqual(result.detectedWorkModels.sort(), ["hybrid", "remote"]);
  assert.deepEqual(result.employmentTypes, ["clt"]);
  assert.equal(result.jobFamily, "engineering");
  assert.equal(result.stackSignals.includes("Node.js"), true);
  assert.equal(result.stackSignals.includes("TypeScript"), true);
  assert.equal(result.stackSignals.includes("React"), true);
  assert.match(result.locationSignals.join(" "), /sao paulo/i);
});
