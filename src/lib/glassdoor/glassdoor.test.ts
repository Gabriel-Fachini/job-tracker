import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  companies,
  glassdoorInterviews,
  glassdoorReviews,
  glassdoorSalaries,
  glassdoorSnapshots,
} from "@/lib/db/schema";

import { makeCompanyPayload, makePayload } from "./fixtures";
import { deleteGlassdoorDataForCompanies } from "./delete";
import { importGlassdoorPayload } from "./import";
import { getGlassdoorTargets } from "./targets";

// These tests write rows: never let them touch a real database.
assert.match(
  process.env.DATABASE_URL ?? "",
  /test\.db$/,
  "glassdoor tests need DATABASE_URL=./tmp/test.db (use `npm test`)",
);

function wipe() {
  db.delete(glassdoorSalaries).run();
  db.delete(glassdoorSnapshots).run();
  db.delete(glassdoorReviews).run();
  db.delete(glassdoorInterviews).run();
  db.delete(companies).run();
}

function insertCompany(values: Partial<typeof companies.$inferInsert> & { name: string }) {
  const now = new Date();
  return db
    .insert(companies)
    .values({ createdAt: now, updatedAt: now, ...values })
    .returning()
    .get();
}

beforeEach(wipe);
after(wipe);

test("import creates the company when nothing matches", () => {
  const result = importGlassdoorPayload(makePayload());
  const [item] = result.companies;

  assert.equal(item.action, "created");
  assert.equal(item.companyName, "Acme Sintética");
  assert.equal(item.newReviews, 3);
  assert.equal(item.newInterviews, 2);
  assert.equal(item.skippedDuplicateSnapshot, false);

  const company = db.select().from(companies).where(eq(companies.id, item.companyId)).get();
  assert.equal(company?.website, "https://acme.example.test");
  assert.equal(company?.sector, "Tecnologia");
  assert.equal(company?.size, "medium");
  assert.match(company?.glassdoorUrl ?? "", /EI_IE1234567/);
  assert.equal(company?.status, "monitoring");

  const snapshot = db.select().from(glassdoorSnapshots).get();
  assert.equal(snapshot?.glassdoorId, 1234567);
  assert.equal(snapshot?.overall, 3.9);
  assert.equal(snapshot?.interviewPositive, 1);
  assert.equal(JSON.parse(snapshot?.dataJson ?? "{}").employer.year_founded, 2016);
  assert.equal(db.select().from(glassdoorSalaries).all().length, 2);
});

test("import keeps the registered name and filled fields when matching by glassdoor_url", () => {
  const existing = insertCompany({
    name: "Nome Escolhido Por Mim",
    website: "https://meu-site.example.test",
    sector: "Meu setor",
    size: "large",
    glassdoorUrl: "https://www.glassdoor.com.br/Avaliações/Outro-Nome-E1234567.htm",
  });

  const [item] = importGlassdoorPayload(makePayload()).companies;

  assert.equal(item.action, "updated");
  assert.equal(item.companyId, existing.id);
  assert.equal(item.companyName, "Nome Escolhido Por Mim");

  const after = db.select().from(companies).where(eq(companies.id, existing.id)).get();
  assert.equal(after?.name, "Nome Escolhido Por Mim");
  assert.equal(after?.website, "https://meu-site.example.test");
  assert.equal(after?.sector, "Meu setor");
  assert.equal(after?.size, "large");
  assert.equal(after?.glassdoorUrl, existing.glassdoorUrl);
  assert.equal(db.select().from(companies).all().length, 1);
});

test("import fills empty website, size, sector and glassdoor_url when matching by name", () => {
  const existing = insertCompany({ name: "  ACME sintetica " });

  const [item] = importGlassdoorPayload(makePayload()).companies;

  assert.equal(item.action, "updated");
  assert.equal(item.companyId, existing.id);

  const after = db.select().from(companies).where(eq(companies.id, existing.id)).get();
  assert.equal(after?.name, "  ACME sintetica ");
  assert.equal(after?.website, "https://acme.example.test");
  assert.equal(after?.sector, "Tecnologia");
  assert.equal(after?.size, "medium");
  assert.match(after?.glassdoorUrl ?? "", /EI_IE1234567/);
});

test("import does not merge a same-name company that belongs to another Glassdoor employer", () => {
  insertCompany({
    name: "Acme Sintética",
    glassdoorUrl: "https://www.glassdoor.com.br/Avaliações/Acme-E999.htm",
  });

  const [item] = importGlassdoorPayload(makePayload()).companies;

  assert.equal(item.action, "created");
  assert.equal(db.select().from(companies).all().length, 2);
});

test("a second import dedupes reviews and interviews and adds only new ones", () => {
  importGlassdoorPayload(makePayload());

  const extra = makeCompanyPayload();
  extra.reviews.items.push({ ...extra.reviews.items[0], id: 1004, date: "2026-09-01T00:00:00.000" });
  extra.interviews.items.push({ ...extra.interviews.items[0], id: 2003 });

  const [item] = importGlassdoorPayload(
    makePayload({ collected_at: "2026-10-28T12:00:00.000Z" }, extra),
  ).companies;

  assert.equal(item.action, "updated");
  assert.equal(item.skippedDuplicateSnapshot, false);
  assert.equal(item.newReviews, 1);
  assert.equal(item.newInterviews, 1);
  assert.equal(db.select().from(glassdoorReviews).all().length, 4);
  assert.equal(db.select().from(glassdoorInterviews).all().length, 3);
  assert.equal(db.select().from(glassdoorSnapshots).all().length, 2);
  assert.equal(db.select().from(companies).all().length, 1);
});

test("re-importing the same file skips the duplicate snapshot", () => {
  const payload = makePayload();
  importGlassdoorPayload(payload);
  const [item] = importGlassdoorPayload(payload).companies;

  assert.equal(item.skippedDuplicateSnapshot, true);
  assert.equal(item.newReviews, 0);
  assert.equal(item.newInterviews, 0);
  assert.equal(db.select().from(glassdoorSnapshots).all().length, 1);
  assert.equal(db.select().from(glassdoorSalaries).all().length, 2);
});

test("import passes collector errors through", () => {
  const result = importGlassdoorPayload(
    makePayload({ errors: [{ glassdoor_id: 5, error: "HTTP 429" }] }),
  );

  assert.deepEqual(result.errors, [{ glassdoorId: 5, error: "HTTP 429" }]);
});

test("targets returns the latest collection dates", () => {
  importGlassdoorPayload(makePayload());

  const [target] = getGlassdoorTargets({ glassdoorId: 1234567 });

  assert.equal(target.name, "Acme Sintética");
  assert.equal(target.glassdoorId, 1234567);
  assert.equal(target.lastCollectedAt, "2026-09-28T12:00:00.000Z");
  assert.equal(target.latestReviewDate, "2026-08-01T10:00:00.000");
  assert.equal(target.latestInterviewDate, "2026-07-01T00:00:00");
});

test("targets returns a single unmatched entry for an unknown company", () => {
  const targets = getGlassdoorTargets({ glassdoorId: 42, name: "Ninguém S.A." });

  assert.deepEqual(targets, [
    {
      companyId: null,
      name: "Ninguém S.A.",
      glassdoorId: 42,
      glassdoorUrl: null,
      lastCollectedAt: null,
      latestReviewDate: null,
      latestInterviewDate: null,
    },
  ]);
});

test("targets without params lists eligible companies, skipping discarded and blacklisted", () => {
  insertCompany({ name: "A sem glassdoor" });
  insertCompany({
    name: "B com url",
    glassdoorUrl: "https://www.glassdoor.com.br/Visão-geral/B-EI_IE77.13,20.htm",
  });
  insertCompany({ name: "C descartada", status: "discarded" });
  insertCompany({ name: "D blacklist", status: "blacklist" });

  const targets = getGlassdoorTargets();

  assert.deepEqual(
    targets.map((target) => [target.name, target.glassdoorId, target.lastCollectedAt]),
    [
      ["A sem glassdoor", null, null],
      ["B com url", 77, null],
    ],
  );
});

test("deleteGlassdoorDataForCompanies clears every Glassdoor table for the company", () => {
  const [item] = importGlassdoorPayload(makePayload()).companies;

  db.transaction((tx) => {
    deleteGlassdoorDataForCompanies(tx, [item.companyId]);
    tx.delete(companies).where(inArray(companies.id, [item.companyId])).run();
  });

  assert.equal(db.select().from(glassdoorSnapshots).all().length, 0);
  assert.equal(db.select().from(glassdoorSalaries).all().length, 0);
  assert.equal(db.select().from(glassdoorReviews).all().length, 0);
  assert.equal(db.select().from(glassdoorInterviews).all().length, 0);
  assert.equal(db.select().from(companies).all().length, 0);
});
