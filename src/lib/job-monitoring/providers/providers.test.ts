import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { discoverViaProvider, resolveAtsProvider } from "./index";
import { extractAshbyOrg, fetchAshbyJobs } from "./ashby";
import { fetchLeverJobs, parseLeverBoardUrl } from "./lever";

function fixture(name: string) {
  return readFileSync(
    path.join(process.cwd(), "src/lib/job-monitoring/providers/__fixtures__", name),
    "utf8",
  );
}

function jsonResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

test("extractAshbyOrg reads the org from jobs.ashbyhq.com URLs only", () => {
  assert.equal(extractAshbyOrg("https://jobs.ashbyhq.com/acme-robotics"), "acme-robotics");
  assert.equal(extractAshbyOrg("https://jobs.ashbyhq.com/acme-robotics/abc?x=1"), "acme-robotics");
  assert.equal(extractAshbyOrg("https://jobs.ashbyhq.com/"), null);
  assert.equal(extractAshbyOrg("https://example.com/acme"), null);
  assert.equal(extractAshbyOrg("not a url"), null);
});

test("parseLeverBoardUrl picks the US or EU API host", () => {
  assert.deepEqual(parseLeverBoardUrl("https://jobs.lever.co/globex-labs"), {
    org: "globex-labs",
    apiBase: "https://api.lever.co",
  });
  assert.deepEqual(parseLeverBoardUrl("https://jobs.eu.lever.co/globex-labs/"), {
    org: "globex-labs",
    apiBase: "https://api.eu.lever.co",
  });
  assert.equal(parseLeverBoardUrl("https://jobs.lever.co/"), null);
  assert.equal(parseLeverBoardUrl("https://lever.co/globex"), null);
});

test("resolveAtsProvider detects Ashby and Lever in auto mode", async () => {
  const base = { id: 1, name: "X", jobBoardNavigationMode: "fetch" as const };

  assert.equal(
    await resolveAtsProvider({ ...base, jobsBoardUrl: "https://jobs.ashbyhq.com/acme-robotics" }),
    "ashby",
  );
  assert.equal(
    await resolveAtsProvider({ ...base, jobsBoardUrl: "https://jobs.lever.co/globex-labs" }),
    "lever",
  );
  assert.equal(
    await resolveAtsProvider({ ...base, jobsBoardUrl: "https://jobs.eu.lever.co/globex-labs" }),
    "lever",
  );
  assert.equal(
    await resolveAtsProvider({ ...base, jobsBoardUrl: "https://acme.com/careers" }),
    "generic",
  );
  assert.equal(
    await resolveAtsProvider({ ...base, jobsBoardUrl: "https://jobs.lever.co/x" }, "generic"),
    "generic",
  );
});

test("fetchAshbyJobs maps listed jobs with salary, location and work model", async () => {
  const calls: string[] = [];
  const links = await fetchAshbyJobs("https://jobs.ashbyhq.com/acme-robotics", async (input) => {
    calls.push(String(input));
    return jsonResponse(fixture("ashby-board.json"));
  });

  assert.deepEqual(calls, [
    "https://api.ashbyhq.com/posting-api/job-board/acme-robotics?includeCompensation=true",
  ]);
  // The unlisted job is dropped.
  assert.equal(links.length, 3);

  const [backend, designer, support] = links;

  assert.equal(
    backend.url,
    "https://jobs.ashbyhq.com/acme-robotics/11111111-aaaa-4bbb-8ccc-000000000001",
  );
  assert.equal(backend.prefetched?.title, "Senior Backend Engineer");
  assert.equal(backend.prefetched?.salaryText, "$140K - $180K");
  assert.equal(backend.prefetched?.workModel, "remote");
  assert.equal(backend.prefetched?.locationText, "Remote - Americas, Brazil, Canada");
  assert.equal(
    backend.prefetched?.applyUrl,
    "https://jobs.ashbyhq.com/acme-robotics/11111111-aaaa-4bbb-8ccc-000000000001/application",
  );
  assert.equal(backend.prefetched?.externalId, "11111111-aaaa-4bbb-8ccc-000000000001");
  assert.match(backend.prefetched?.descriptionHtml ?? "", /TypeScript/);

  // Falls back to the structured salary component when there is no summary.
  assert.equal(designer.prefetched?.salaryText, "EUR 70,000-90,000 / year");
  assert.equal(designer.prefetched?.workModel, "hybrid");

  assert.equal(support.prefetched?.salaryText, undefined);
  // No workplaceType but isRemote=true.
  assert.equal(support.prefetched?.workModel, "remote");
});

test("fetchAshbyJobs reports invalid boards and HTTP failures", async () => {
  await assert.rejects(
    fetchAshbyJobs("https://jobs.ashbyhq.com/nope", async () => jsonResponse("{}", 404)),
    /Ashby board inválido/,
  );
  await assert.rejects(
    fetchAshbyJobs("https://jobs.ashbyhq.com/nope", async () => jsonResponse("{}", 500)),
    /500/,
  );
  assert.deepEqual(await fetchAshbyJobs("https://example.com/x", async () => jsonResponse("{}")), []);
});

test("fetchLeverJobs maps postings with lists, salary and work model", async () => {
  const calls: string[] = [];
  const links = await fetchLeverJobs("https://jobs.lever.co/globex-labs", async (input) => {
    calls.push(String(input));
    return jsonResponse(fixture("lever-postings.json"));
  });

  assert.deepEqual(calls, ["https://api.lever.co/v0/postings/globex-labs?mode=json"]);
  assert.equal(links.length, 3);

  const [staff, ae, analyst] = links;

  assert.equal(staff.prefetched?.title, "Staff Platform Engineer");
  assert.equal(staff.prefetched?.salaryText, "USD 150,000-190,000 / year");
  assert.equal(staff.prefetched?.workModel, "remote");
  assert.equal(staff.prefetched?.locationText, "Remote - LATAM, Mexico");
  assert.equal(
    staff.prefetched?.applyUrl,
    "https://jobs.lever.co/globex-labs/22222222-bbbb-4ccc-8ddd-000000000001/apply",
  );
  const html = staff.prefetched?.descriptionHtml ?? "";
  assert.match(html, /Globex Labs/);
  assert.match(html, /<h3>What you&#39;ll do<\/h3>|<h3>What you'll do<\/h3>/);
  assert.match(html, /<ul><li>Own the deploy pipeline<\/li>/);
  assert.match(html, /equal opportunity employer/);

  assert.equal(ae.prefetched?.salaryText, "USD 80-95 / hour");
  assert.equal(ae.prefetched?.workModel, "onsite");
  assert.match(ae.prefetched?.descriptionHtml ?? "", /<p>Sell things\.<\/p><p>Travel required\.<\/p>/);

  assert.equal(analyst.prefetched?.workModel, undefined);
  assert.equal(analyst.prefetched?.salaryText, undefined);
  assert.equal(analyst.prefetched?.locationText, undefined);
});

test("fetchLeverJobs uses the EU API for jobs.eu.lever.co", async () => {
  const calls: string[] = [];
  await fetchLeverJobs("https://jobs.eu.lever.co/globex-labs", async (input) => {
    calls.push(String(input));
    return jsonResponse("[]");
  });

  assert.deepEqual(calls, ["https://api.eu.lever.co/v0/postings/globex-labs?mode=json"]);
});

test("discoverViaProvider dispatches to Ashby and Lever with the injected fetch", async () => {
  const urls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return jsonResponse(String(input).includes("ashbyhq") ? fixture("ashby-board.json") : "[]");
  }) as typeof fetch;

  const ashby = await discoverViaProvider(
    {
      id: 1,
      name: "Acme",
      jobsBoardUrl: "https://jobs.ashbyhq.com/acme-robotics",
      jobBoardNavigationMode: "fetch",
    },
    "ashby",
    { fetchImpl },
  );
  const lever = await discoverViaProvider(
    {
      id: 2,
      name: "Globex",
      jobsBoardUrl: "https://jobs.lever.co/globex-labs",
      jobBoardNavigationMode: "fetch",
    },
    "lever",
    { fetchImpl },
  );

  assert.equal(ashby?.length, 3);
  assert.deepEqual(lever, []);
  assert.equal(urls.length, 2);

  // A provider forced on a URL from another host falls back to generic discovery.
  const mismatched = await discoverViaProvider(
    {
      id: 3,
      name: "Other",
      jobsBoardUrl: "https://example.com/careers",
      jobBoardNavigationMode: "fetch",
    },
    "ashby",
    { fetchImpl },
  );
  assert.equal(mismatched, null);
});
