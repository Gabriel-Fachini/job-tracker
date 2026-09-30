import assert from "node:assert/strict";
import test from "node:test";

import type { AtsDiscovery } from "./ats-discovery";
import {
  filterYcCompanies,
  importYcCompanies,
  type YcCompany,
  type YcImportStore,
} from "./yc-import";

const dataset: YcCompany[] = [
  { name: "Remote Co", website: "https://remote.example", isHiring: true, status: "Active", regions: ["Remote", "Partly Remote"], url: "https://yc.example/remote-co" },
  { name: "Located Remote", website: "https://loc.example", isHiring: true, status: "Active", regions: ["United States"], all_locations: "San Francisco, CA, USA; Remote" },
  { name: "Partly Only", website: "https://partly.example", isHiring: true, status: "Active", regions: ["Partly Remote"], all_locations: "Boston" },
  { name: "Not Hiring", website: "https://nh.example", isHiring: false, status: "Active", regions: ["Remote"] },
  { name: "Dead", website: "https://dead.example", isHiring: true, status: "Inactive", regions: ["Remote"] },
  { name: "Known Co", website: "https://known.example", isHiring: true, status: "Active", regions: ["Remote"] },
  { name: "Known Co", website: "https://known.example", isHiring: true, status: "Active", regions: ["Remote"] },
];

const ashby: AtsDiscovery = {
  provider: "ashby",
  boardUrl: "https://jobs.ashbyhq.com/remote-co",
  slug: "remote-co",
  jobsCount: 5,
  via: "link",
};

test("filterYcCompanies keeps active, hiring, remote companies", () => {
  assert.deepEqual(
    filterYcCompanies(dataset).map((company) => company.name),
    ["Remote Co", "Located Remote", "Known Co", "Known Co"],
  );
});

function fakeStore() {
  const created: Array<Parameters<YcImportStore["createCompany"]>[0]> = [];
  const applied: Array<[number, AtsDiscovery]> = [];
  const store: YcImportStore = {
    existingCompanies: () => [
      { id: 1, name: "Known Co", website: "https://known.example", origin: "manual", jobsBoardUrl: null },
      { id: 2, name: "Has Board", website: "https://hasboard.example", origin: "manual", jobsBoardUrl: "https://jobs.lever.co/x" },
    ],
    createCompany: (input) => {
      created.push(input);
      return 100 + created.length;
    },
    applyDiscovery: (id, ats) => applied.push([id, ats]),
  };

  return { store, created, applied };
}

test("importYcCompanies creates new companies, fills boards of known ones and leaves the rest alone", async () => {
  const { store, created, applied } = fakeStore();
  const discovered: string[] = [];

  const { rows, summary } = await importYcCompanies({
    companies: [
      ...filterYcCompanies(dataset),
      { name: "Has Board", website: "https://hasboard.example", isHiring: true, status: "Active", regions: ["Remote"] },
    ],
    store,
    discover: async (company) => {
      discovered.push(company.name);
      return company.name === "Remote Co" || company.name === "Known Co" ? ashby : null;
    },
  });

  // "Known Co" appears twice in the dataset: processed once. "Has Board" is never searched.
  assert.deepEqual(discovered.sort(), ["Known Co", "Located Remote", "Remote Co"]);
  const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name);

  assert.deepEqual(
    [...created].sort(byName),
    [
      { name: "Located Remote", website: "https://loc.example", jobsBoardUrl: null, atsProvider: "auto", radarEnabled: false },
      { name: "Remote Co", website: "https://remote.example", jobsBoardUrl: ashby.boardUrl, atsProvider: "ashby", radarEnabled: true },
    ],
  );
  assert.deepEqual(applied.map(([id]) => id), [1]);
  assert.deepEqual(summary, {
    total: 4,
    created: 2,
    updated: 1,
    unchanged: 1,
    withAts: 2,
    withoutAts: 2,
    byProvider: { ashby: 2 },
  });
  assert.equal(rows.find((row) => row.name === "Has Board")?.action, "unchanged");
});

test("importYcCompanies in dry-run mode never writes but reports the same plan", async () => {
  const { store, created, applied } = fakeStore();

  const { summary } = await importYcCompanies({
    companies: filterYcCompanies(dataset),
    store,
    dryRun: true,
    discover: async () => ashby,
  });

  assert.deepEqual(created, []);
  assert.deepEqual(applied, []);
  assert.equal(summary.created, 2);
  assert.equal(summary.updated, 1);
  assert.equal(summary.withAts, 3);
});

test("importYcCompanies refuses to write without a store", async () => {
  await assert.rejects(importYcCompanies({ companies: [] }), /store/);
  const empty = await importYcCompanies({ companies: [], dryRun: true });
  assert.equal(empty.summary.total, 0);
});

test("importYcCompanies is idempotent: a second run over the created companies changes nothing", async () => {
  const state: Array<{ id: number; name: string; website: string | null; origin: string; jobsBoardUrl: string | null }> = [];
  const store: YcImportStore = {
    existingCompanies: () => state.map((row) => ({ ...row })),
    createCompany: (input) => {
      const id = state.length + 1;
      state.push({ id, name: input.name, website: input.website, origin: "yc_import", jobsBoardUrl: input.jobsBoardUrl });
      return id;
    },
    applyDiscovery: (id, ats) => {
      state.find((row) => row.id === id)!.jobsBoardUrl = ats.boardUrl;
    },
  };
  const options = {
    companies: filterYcCompanies(dataset),
    store,
    discover: async (company: { name: string }) => (company.name === "Remote Co" ? ashby : null),
  };

  const first = await importYcCompanies(options);
  const second = await importYcCompanies(options);

  assert.equal(first.summary.created, 3);
  assert.equal(second.summary.created, 0);
  assert.equal(second.summary.updated, 0);
  assert.equal(state.length, 3);
});
