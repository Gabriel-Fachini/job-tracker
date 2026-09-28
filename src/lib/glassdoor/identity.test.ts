import test from "node:test";
import assert from "node:assert/strict";

import { mapGlassdoorSize, normalizeCompanyName, parseGlassdoorId } from "./identity";
import { GlassdoorPayloadError, parseGlassdoorPayload } from "./payload";
import { makePayload } from "./fixtures";

test("parseGlassdoorId reads both URL shapes", () => {
  assert.equal(
    parseGlassdoorId("https://www.glassdoor.com.br/Visão-geral/Trabalhar-na-X-EI_IE2808477.13,20.htm"),
    2808477,
  );
  assert.equal(parseGlassdoorId("https://www.glassdoor.com.br/Avaliações/X-E123.htm"), 123);
  assert.equal(parseGlassdoorId("https://example.test/no-id"), null);
  assert.equal(parseGlassdoorId(null), null);
});

test("normalizeCompanyName ignores case, accents and extra spaces", () => {
  assert.equal(normalizeCompanyName("  Açaí   Tecnologia "), "acai tecnologia");
});

test("mapGlassdoorSize maps headcount labels by upper bound", () => {
  assert.equal(mapGlassdoorSize("1 a 50 funcionários"), "small");
  assert.equal(mapGlassdoorSize("201 a 500 funcionários"), "medium");
  assert.equal(mapGlassdoorSize("1.001 a 5.000 funcionários"), "large");
  assert.equal(mapGlassdoorSize("Mais de 10.000 funcionários"), "enterprise");
  assert.equal(mapGlassdoorSize("Desconhecido"), null);
});

test("parseGlassdoorPayload accepts a v1 payload and drops unstored fields", () => {
  const parsed = parseGlassdoorPayload(makePayload());
  const company = parsed.companies[0];

  assert.equal(company.employer.glassdoorId, 1234567);
  assert.equal(company.reviews.length, 3);
  assert.equal(company.salaries[0].base.p50, 6000);
  assert.equal("logoUrl" in company.employer, false);
  assert.equal(parsed.collectedAt.toISOString(), "2026-09-28T12:00:00.000Z");
});

test("parseGlassdoorPayload rejects unknown versions and broken shapes", () => {
  assert.throws(() => parseGlassdoorPayload(makePayload({ schema_version: 2 })), GlassdoorPayloadError);
  assert.throws(() => parseGlassdoorPayload({ schema_version: 1 }), GlassdoorPayloadError);
  assert.throws(() => parseGlassdoorPayload(makePayload({ collected_at: "ontem" })), GlassdoorPayloadError);
  assert.throws(() => parseGlassdoorPayload(makePayload({ companies: [] })), GlassdoorPayloadError);
  assert.throws(
    () => parseGlassdoorPayload(makePayload({}, { employer: { glassdoor_id: "x", name: "A" } })),
    GlassdoorPayloadError,
  );
  assert.throws(() => parseGlassdoorPayload(null), GlassdoorPayloadError);
});
