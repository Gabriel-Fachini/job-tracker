import assert from "node:assert/strict";
import test from "node:test";

import { fetchHimalayasJobs } from "./himalayas";
import { fetchHnWhoIsHiringJobs, mapHnComment, parseHnHeader } from "./hn";
import { fetchJobicyJobs } from "./jobicy";
import { fetchRemoteOkJobs } from "./remoteok";
import { fetchWeWorkRemotelyJobs, parseWeWorkRemotelyFeed } from "./weworkremotely";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function xml(body: string) {
  return new Response(body, { status: 200, headers: { "content-type": "application/rss+xml" } });
}

function routedFetch(routes: Array<[RegExp, () => Response]>, calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const route = routes.find(([pattern]) => pattern.test(url));

    if (!route) {
      throw new Error(`unexpected request ${url}`);
    }

    return route[1]();
  }) as typeof fetch;
}

const himalayasJob = (n: number, pubDate: number, extra: Record<string, unknown> = {}) => ({
  title: `Backend Engineer ${n}`,
  excerpt: "Short",
  companyName: "Initech Labs",
  employmentType: "Full Time",
  minSalary: 5000,
  maxSalary: 7000,
  salaryPeriod: "monthly",
  currency: "USD",
  seniority: ["Senior"],
  locationRestrictions: ["Brazil", "Argentina"],
  timezoneRestrictions: [-3, -4],
  description: `<p>Job ${n}</p>`,
  pubDate,
  applicationLink: `https://himalayas.example/jobs/${n}/apply`,
  guid: `https://himalayas.example/jobs/${n}`,
  ...extra,
});

test("Himalayas maps fields and stops at the previous run's cursor", async () => {
  const calls: string[] = [];
  const fetchImpl = routedFetch(
    [
      [
        /cursor=page2/,
        () => json({ jobs: [himalayasJob(3, 800), himalayasJob(4, 700)], nextCursor: "page3" }),
      ],
      [/himalayas\.app\/jobs\/api/, () => json({ jobs: [himalayasJob(1, 1000), himalayasJob(2, 900)], nextCursor: "page2" })],
    ],
    calls,
  );

  const result = await fetchHimalayasJobs({ fetchImpl, cursor: "800" });

  // 800 and 700 are not newer than the cursor: pagination ends there.
  assert.deepEqual(
    result.jobs.map((job) => job.title),
    ["Backend Engineer 1", "Backend Engineer 2"],
  );
  assert.equal(result.cursor, "1000");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /limit=20/);

  const [job] = result.jobs;
  assert.equal(job.sourceKind, "himalayas");
  assert.equal(job.companyName, "Initech Labs");
  assert.deepEqual(job.locationRestrictions, ["Brazil", "Argentina"]);
  assert.deepEqual(job.timezoneRestrictions, [-3, -4]);
  assert.deepEqual(job.salary, { min: 5000, max: 7000, currency: "USD", period: "month" });
  assert.equal(job.seniority, "senior");
  assert.equal(job.applyUrl, "https://himalayas.example/jobs/1/apply");
  assert.equal(job.publishedAt?.getTime(), 1_000_000);
});

test("Himalayas honors maxPages on the first run and keeps the old cursor when nothing is new", async () => {
  let page = 0;
  const fetchImpl = (async () => {
    page += 1;
    return json({ jobs: [himalayasJob(page, 5000 - page)], nextCursor: `c${page}` });
  }) as typeof fetch;

  const first = await fetchHimalayasJobs({ fetchImpl, config: { maxPages: 3 } });

  assert.equal(first.jobs.length, 3);
  assert.equal(first.cursor, "4999");

  const none = await fetchHimalayasJobs({
    fetchImpl: (async () => json({ jobs: [himalayasJob(1, 100)], nextCursor: null })) as typeof fetch,
    cursor: "5000",
  });

  assert.deepEqual(none.jobs, []);
  assert.equal(none.cursor, "5000");
});

test("Himalayas propagates HTTP failures", async () => {
  await assert.rejects(
    fetchHimalayasJobs({ fetchImpl: (async () => json({}, 503)) as typeof fetch }),
    /HTTP 503/,
  );
});

test("RemoteOK skips the legal notice and treats 0 salaries as unknown", async () => {
  const fetchImpl = (async () =>
    json([
      { legal: "Please link back to Remote OK" },
      {
        id: "1001",
        slug: "remote-engineer-globex-1001",
        epoch: 1_790_000_000,
        company: "Globex",
        position: "Platform Engineer",
        description: "<p>Build things</p>",
        location: "Worldwide",
        apply_url: "https://remoteok.example/remote-jobs/apply-1001",
        url: "https://remoteok.example/remote-jobs/remote-engineer-globex-1001",
        salary_min: 120000,
        salary_max: 150000,
      },
      {
        id: "1002",
        company: "Hooli",
        position: "Support Agent",
        url: "https://remoteok.example/remote-jobs/support-1002",
        salary_min: 0,
        salary_max: 0,
      },
      { id: "1003", position: "No company" },
    ])) as typeof fetch;

  const { jobs } = await fetchRemoteOkJobs({ fetchImpl });

  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0].salary, { min: 120000, max: 150000, currency: "USD", period: "year" });
  assert.equal(jobs[0].externalId, "1001");
  assert.equal(jobs[0].publishedAt?.getTime(), 1_790_000_000_000);
  assert.equal(jobs[1].salary, undefined);
  assert.equal(jobs[1].applyUrl, undefined);
});

const wwrFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>WWR</title>
<item>
  <title>Umbrella Corp: Senior Backend Engineer: Payments</title>
  <region>Anywhere in the World</region>
  <category>Back-End Programming</category>
  <description>&lt;p&gt;Build &lt;b&gt;APIs&lt;/b&gt;&lt;/p&gt;</description>
  <pubDate>Mon, 14 Sep 2026 07:31:07 +0000</pubDate>
  <guid>https://wwr.example/remote-jobs/umbrella-backend</guid>
  <link>https://wwr.example/remote-jobs/umbrella-backend</link>
</item>
<item>
  <title>Stark Industries: DevOps Engineer</title>
  <region>USA Only</region>
  <description>&lt;p&gt;Ship&lt;/p&gt;</description>
  <pubDate>Sun, 13 Sep 2026 07:31:12 +0000</pubDate>
  <guid>https://wwr.example/remote-jobs/stark-devops</guid>
  <link>https://wwr.example/remote-jobs/stark-devops</link>
</item>
<item><title>Broken title without colon</title><link>https://wwr.example/x</link></item>
</channel></rss>`;

test("We Work Remotely parses 'Company: Role' titles, region and HTML descriptions", () => {
  const jobs = parseWeWorkRemotelyFeed(wwrFeed);

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].companyName, "Umbrella Corp");
  assert.equal(jobs[0].title, "Senior Backend Engineer: Payments");
  assert.equal(jobs[0].descriptionHtml, "<p>Build <b>APIs</b></p>");
  assert.deepEqual(jobs[0].locationRestrictions, []);
  assert.equal(jobs[0].locationText, "Anywhere in the World");
  assert.deepEqual(jobs[1].locationRestrictions, ["USA Only"]);
  assert.equal(jobs[1].publishedAt?.toISOString(), "2026-09-13T07:31:12.000Z");
});

test("We Work Remotely fetches each category in sequence and dedupes by guid", async () => {
  const calls: string[] = [];
  const fetchImpl = routedFetch(
    [[/categories\/.*\.rss$/, () => xml(wwrFeed)]],
    calls,
  );

  const { jobs } = await fetchWeWorkRemotelyJobs({
    fetchImpl,
    config: { categories: ["remote-programming-jobs", "remote-devops-sysadmin-jobs"] },
  });

  assert.equal(calls.length, 2);
  assert.equal(jobs.length, 2);
});

test("We Work Remotely tolerates one failing category but not all of them", async () => {
  let n = 0;
  const partial = (async () => {
    n += 1;
    return n === 1 ? xml("nope") : xml(wwrFeed);
  }) as typeof fetch;
  // "nope" is not a feed: it parses to zero jobs but counts as a success.
  assert.equal((await fetchWeWorkRemotelyJobs({ fetchImpl: partial })).jobs.length, 2);

  await assert.rejects(
    fetchWeWorkRemotelyJobs({ fetchImpl: (async () => json({}, 500)) as typeof fetch }),
    /HTTP 500/,
  );
});

test("Jobicy maps geo, yearly salary and uses the job URL to apply", async () => {
  const calls: string[] = [];
  const fetchImpl = routedFetch(
    [
      [
        /jobicy/,
        () =>
          json({
            jobs: [
              {
                id: 501,
                url: "https://jobicy.example/jobs/501-backend",
                jobTitle: "Backend Engineer",
                companyName: "Wayne Tech",
                jobType: ["Full-Time"],
                jobGeo: "EMEA,  LATAM,  Canada",
                jobLevel: "Senior",
                jobDescription: "<p>Desc</p>",
                pubDate: "2026-09-27T07:20:11+00:00",
                salaryMin: 100000,
                salaryMax: 130000,
                salaryCurrency: "USD",
                salaryPeriod: "yearly",
              },
              { id: 502, url: "https://jobicy.example/jobs/502", jobTitle: "Anywhere Dev", companyName: "Cyberdyne", jobGeo: "Anywhere" },
              { id: 503, jobTitle: "No url", companyName: "X" },
            ],
          }),
      ],
    ],
    calls,
  );

  const { jobs } = await fetchJobicyJobs({ fetchImpl });

  assert.match(calls[0], /count=50/);
  assert.match(calls[0], /industry=dev/);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0].locationRestrictions, ["EMEA", "LATAM", "Canada"]);
  assert.deepEqual(jobs[0].salary, { min: 100000, max: 130000, currency: "USD", period: "year" });
  assert.equal(jobs[0].applyUrl, jobs[0].url);
  assert.equal(jobs[0].seniority, "senior");
  assert.deepEqual(jobs[1].locationRestrictions, []);

  await fetchJobicyJobs({ fetchImpl, config: { tags: ["backend", "node"], count: 10 } });
  assert.match(calls[1], /tag=backend%2Cnode/);
  assert.doesNotMatch(calls[1], /industry=/);
});

test("parseHnHeader reads Company | Role | Location and falls back when the role is missing", () => {
  assert.deepEqual(
    parseHnHeader(
      'Modash | Senior Product Engineer | Remote (Europe) | Full-time | &euro;75k | <a href="https:&#x2F;&#x2F;modash.example" rel="nofollow">https:&#x2F;&#x2F;modash.example</a>',
    ),
    {
      company: "Modash",
      title: "Senior Product Engineer",
      location: "Remote (Europe)",
      website: "https://modash.example",
    },
  );

  const fallback = parseHnHeader("Acme | REMOTE | Full-time | we build things");
  assert.equal(fallback?.company, "Acme");
  assert.equal(fallback?.title, "Vaga (HN)");
  assert.equal(fallback?.location, "REMOTE");

  const noPipes = parseHnHeader("We are hiring engineers, remote ok");
  assert.equal(noPipes?.title, "Vaga (HN)");
  assert.equal(noPipes?.company, "We are hiring engineers, remote ok");

  assert.equal(parseHnHeader(""), null);
});

test("mapHnComment keeps only comments that mention remote", () => {
  const remote = mapHnComment({
    id: 9001,
    created_at: "2026-09-01T15:01:54.000Z",
    text: "Quill | Fullstack SWE | Remote, PT&#x2F;ET hours | $150 - 210K USD<p>We build things.",
  });
  const onsite = mapHnComment({ id: 9002, text: "Umbrella | SRE | Berlin | ONSITE<p>Come to the office" });

  assert.equal(remote?.url, "https://news.ycombinator.com/item?id=9001");
  assert.equal(remote?.companyName, "Quill");
  assert.equal(remote?.title, "Fullstack SWE");
  assert.equal(remote?.externalId, "9001");
  assert.equal(onsite, null);
});

test("HN picks the latest 'Who is hiring' thread and keeps only top-level remote comments", async () => {
  const calls: string[] = [];
  const fetchImpl = routedFetch(
    [
      [
        /search_by_date/,
        () =>
          json({
            hits: [
              { objectID: "300", title: "Ask HN: Who wants to be hired? (September 2026)", created_at: "2026-09-01T15:00:00Z" },
              { objectID: "200", title: "Ask HN: Who is hiring? (September 2026)", created_at: "2026-09-01T15:00:00Z" },
              { objectID: "100", title: "Ask HN: Who is hiring? (August 2026)", created_at: "2026-08-01T15:00:00Z" },
            ],
          }),
      ],
      [
        /items\/200/,
        () =>
          json({
            id: 200,
            children: [
              { id: 201, text: "Initech | Backend Engineer | Remote | Full-time<p>Details", children: [] },
              { id: 202, text: "Hooli | Designer | San Francisco | ONSITE", children: [] },
              { id: 203, text: null, children: [] },
            ],
          }),
      ],
    ],
    calls,
  );

  const { jobs, cursor } = await fetchHnWhoIsHiringJobs({ fetchImpl });

  assert.equal(calls.length, 2);
  assert.equal(cursor, "200");
  assert.deepEqual(jobs.map((job) => [job.companyName, job.title]), [["Initech", "Backend Engineer"]]);

  const empty = await fetchHnWhoIsHiringJobs({
    fetchImpl: (async () => json({ hits: [{ objectID: "1", title: "Ask HN: Who wants to be hired?" }] })) as typeof fetch,
  });
  assert.deepEqual(empty.jobs, []);
});
