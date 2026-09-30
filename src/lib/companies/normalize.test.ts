import assert from "node:assert/strict";
import test from "node:test";

import { CompanyIndex } from "./company-index";
import {
  buildDedupKey,
  extractDomain,
  normalizeCompanyName,
  normalizeTitleForDedup,
  normalizeWebsiteOrigin,
} from "./normalize";

test("normalizeCompanyName drops accents, punctuation and legal suffixes", () => {
  assert.equal(normalizeCompanyName("Acme, Inc."), "acme");
  assert.equal(normalizeCompanyName("ACME LLC"), "acme");
  assert.equal(normalizeCompanyName("Acme Ltd"), "acme");
  assert.equal(normalizeCompanyName("Acme GmbH"), "acme");
  assert.equal(normalizeCompanyName("Acme Corp."), "acme");
  assert.equal(normalizeCompanyName("Acme Co"), "acme");
  assert.equal(normalizeCompanyName("Açaí Tecnologia S.A."), "acaitecnologia");
  assert.equal(normalizeCompanyName("Open AI"), normalizeCompanyName("OpenAI"));
  assert.equal(normalizeCompanyName("Modash.io"), "modash");
  assert.equal(normalizeCompanyName("The Globex Corporation"), "globex");
  assert.equal(normalizeCompanyName("Ben & Jerry's"), "benandjerrys");
  // A name that is only a suffix stays as is.
  assert.equal(normalizeCompanyName("Inc"), "inc");
});

test("extractDomain returns the registrable domain", () => {
  assert.equal(extractDomain("https://www.acme.com/careers"), "acme.com");
  assert.equal(extractDomain("jobs.acme.io"), "acme.io");
  assert.equal(extractDomain("https://acme.co.uk"), "acme.co.uk");
  assert.equal(extractDomain("https://localhost"), null);
  assert.equal(extractDomain(""), null);
  assert.equal(extractDomain(null), null);
});

test("normalizeWebsiteOrigin keeps only the origin of http(s) URLs", () => {
  assert.equal(normalizeWebsiteOrigin("https://acme.com/about?x=1"), "https://acme.com");
  assert.equal(normalizeWebsiteOrigin("acme.com"), "https://acme.com");
  assert.equal(normalizeWebsiteOrigin("mailto:a@b.co"), null);
});

test("normalizeTitleForDedup ignores punctuation, brackets and remote words", () => {
  assert.equal(
    normalizeTitleForDedup("Senior Backend Engineer (Remote)"),
    normalizeTitleForDedup("Senior Backend Engineer - Remote - Worldwide"),
  );
  assert.equal(normalizeTitleForDedup("C++ Engineer"), "c++ engineer");
  assert.notEqual(normalizeTitleForDedup("Backend Engineer"), normalizeTitleForDedup("Frontend Engineer"));
});

test("buildDedupKey matches the same company and role across spellings", () => {
  assert.equal(
    buildDedupKey("Acme, Inc.", "Senior Backend Engineer (Remote)"),
    buildDedupKey("ACME", "senior backend engineer"),
  );
  assert.notEqual(buildDedupKey("Acme", "Backend Engineer"), buildDedupKey("Globex", "Backend Engineer"));
  assert.notEqual(buildDedupKey("Acme", "Backend Engineer"), buildDedupKey("Acme", "Data Engineer"));
  assert.match(buildDedupKey("Acme", "Dev"), /^[a-f0-9]{32}$/);
});

test("CompanyIndex finds by domain first, then by normalized name, and creates once", () => {
  const index = new CompanyIndex([
    { id: 1, name: "Acme Inc", website: "https://acme.com" },
    { id: 2, name: "Globex", website: null },
    { id: 3, name: "Lever Users", website: "https://jobs.lever.co/x" },
  ]);

  assert.equal(index.find({ name: "Something else", website: "https://www.acme.com/about" }), 1);
  assert.equal(index.find({ name: "ACME" }), 1);
  assert.equal(index.find({ name: "globex, llc" }), 2);
  assert.equal(index.find({ name: "Nope" }), null);
  // Shared platforms never merge companies by domain.
  assert.equal(index.find({ name: "Other", website: "https://jobs.lever.co/y" }), null);

  let nextId = 10;
  const created: string[] = [];
  const create = (input: { name: string; website: string | null }) => {
    created.push(input.name);
    return nextId++;
  };

  const first = index.resolve({ name: "Initech", website: "https://initech.io/jobs" }, create);
  const second = index.resolve({ name: "Initech LLC" }, create);

  assert.deepEqual(first, { id: 10, created: true });
  assert.deepEqual(second, { id: 10, created: false });
  assert.deepEqual(created, ["Initech"]);
  assert.equal(index.find({ name: "x", website: "initech.io" }), 10);
});
