import assert from "node:assert/strict";
import test from "node:test";

import {
  countBoardJobs,
  discoverAts,
  extractAtsCandidates,
  guessSlugs,
} from "./ats-discovery";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** ATS API stub: `boards` maps a request URL substring to a job count; anything else is a 404. */
function apiStub(boards: Record<string, number>, calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(boards).find((candidate) => url.includes(candidate));

    if (!key) {
      return json({}, 404);
    }

    const count = boards[key];

    if (url.includes("api.lever.co") || url.includes("api.eu.lever.co")) {
      return json(Array.from({ length: count }, () => ({})));
    }

    return json({ jobs: Array.from({ length: count }, () => ({})) });
  }) as typeof fetch;
}

test("extractAtsCandidates finds Ashby, Lever (US/EU) and Greenhouse references", () => {
  const html = `
    <html><body>
      <a href="https://jobs.ashbyhq.com/acme-robotics">Careers</a>
      <a href="https://jobs.lever.co/globex-labs/1234-abcd">Apply</a>
      <a href="https://jobs.eu.lever.co/initech-eu">EU</a>
      <iframe src="https://boards.greenhouse.io/embed/job_board?for=hooli"></iframe>
      <a href="https://job-boards.greenhouse.io/umbrella/jobs/55">Job</a>
      <a href="https://jobs.lever.co/">no slug</a>
      <a href="https://myjobs.lever.co/not-a-board">other host</a>
      <script>window.location = "https://jobs.ashbyhq.com/embed"</script>
    </body></html>`;
  const found = extractAtsCandidates(html).map((candidate) => `${candidate.provider}:${candidate.region ?? "us"}:${candidate.slug}`);

  assert.deepEqual(found.sort(), [
    "ashby:us:acme-robotics",
    "greenhouse:us:hooli",
    "greenhouse:us:umbrella",
    "lever:eu:initech-eu",
    "lever:us:globex-labs",
  ]);
});

test("guessSlugs uses the domain label and name variants without duplicates", () => {
  assert.deepEqual(guessSlugs("Acme Robotics, Inc.", "https://www.acmerobotics.com"), [
    "acmerobotics",
    "acme-robotics-inc",
  ]);
  assert.deepEqual(guessSlugs("Açaí Labs", null), ["acailabs", "acai-labs"]);
  assert.deepEqual(guessSlugs("X", null), []);
});

test("countBoardJobs reads Ashby/Greenhouse ({jobs}) and Lever (array) answers", async () => {
  const fetchImpl = apiStub({ "job-board/acme": 3, "boards/hooli": 0, "postings/globex": 2 });

  assert.equal(await countBoardJobs({ provider: "ashby", slug: "acme" }, fetchImpl), 3);
  assert.equal(await countBoardJobs({ provider: "greenhouse", slug: "hooli" }, fetchImpl), 0);
  assert.equal(await countBoardJobs({ provider: "lever", slug: "globex" }, fetchImpl), 2);
  assert.equal(await countBoardJobs({ provider: "lever", slug: "nope" }, fetchImpl), null);
  assert.equal(
    await countBoardJobs({ provider: "ashby", slug: "boom" }, (async () => {
      throw new Error("network");
    }) as typeof fetch),
    null,
  );
});

test("discoverAts prefers the link on the company's own site and accepts an empty board", async () => {
  const pages: string[] = [];
  const result = await discoverAts(
    { name: "Acme Robotics", website: "https://acme.example" },
    {
      fetchPage: async (url) => {
        pages.push(url);
        return url.endsWith("/careers")
          ? '<a href="https://jobs.lever.co/acme-robotics">Jobs</a>'
          : "<html>nothing</html>";
      },
      fetchImpl: apiStub({ "postings/acme-robotics": 0 }),
    },
  );

  assert.deepEqual(pages, ["https://acme.example/", "https://acme.example/careers"]);
  assert.deepEqual(result, {
    provider: "lever",
    boardUrl: "https://jobs.lever.co/acme-robotics",
    slug: "acme-robotics",
    jobsCount: 0,
    via: "link",
  });
});

test("discoverAts falls back to guessing slugs and requires open jobs", async () => {
  const calls: string[] = [];
  const result = await discoverAts(
    { name: "Globex Labs", website: "https://globex.example" },
    {
      fetchPage: async () => null,
      // Ashby has an empty "globex" board (ignored), Greenhouse has jobs under the hyphenated name.
      fetchImpl: apiStub({ "job-board/globex": 0, "boards/globex-labs": 4 }, calls),
    },
  );

  assert.deepEqual(result, {
    provider: "greenhouse",
    boardUrl: "https://boards.greenhouse.io/globex-labs",
    slug: "globex-labs",
    jobsCount: 4,
    via: "slug",
  });
  // The domain label ("globex") was tried on the three ATS before the name variants.
  assert.ok(calls[0].includes("job-board/globex"));
});

test("discoverAts returns null when nothing is found and ignores an unreachable site", async () => {
  const result = await discoverAts(
    { name: "Nowhere Inc", website: "https://nowhere.example" },
    { fetchPage: async () => null, fetchImpl: apiStub({}) },
  );

  assert.equal(result, null);
  assert.equal(
    await discoverAts({ name: "Nowhere Inc", website: "not a url" }, { fetchPage: async () => null, fetchImpl: apiStub({}) }),
    null,
  );
});
