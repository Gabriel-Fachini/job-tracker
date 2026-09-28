import * as cheerio from "cheerio";

import { fetchPublicResource } from "@/lib/net/public-fetch";

import { extractDomain, normalizeCompanyName } from "./normalize";

/**
 * Finds a company's ATS board: first the links on its own site (home, /careers,
 * /jobs), then by guessing the slug directly on the ATS public APIs. Only
 * Ashby, Lever and Greenhouse (the providers with a public JSON API).
 */

export type DiscoveredAtsProvider = "ashby" | "lever" | "greenhouse";

export type AtsDiscovery = {
  provider: DiscoveredAtsProvider;
  /** Board URL the radar can use as `jobs_board_url`. */
  boardUrl: string;
  slug: string;
  jobsCount: number;
  /** `link`: found on the company's site. `slug`: guessed from the name/domain (may be a homonym). */
  via: "link" | "slug";
};

export type AtsDiscoveryDeps = {
  /** HTML of a page, or null when unreachable. Default: SSRF-safe public fetch. */
  fetchPage?: (url: string) => Promise<string | null>;
  /** Used for the ATS JSON APIs (known public hosts). */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

type Candidate = { provider: DiscoveredAtsProvider; slug: string; region?: "eu" };

const CAREER_PATHS = ["", "/careers", "/jobs"];
const MAX_PAGE_BYTES = 1024 * 1024;
const API_TIMEOUT_MS = 8_000;

/** Never a real board slug. */
const IGNORED_SLUGS = new Set([
  "embed",
  "api",
  "v1",
  "jobs",
  "job",
  "careers",
  "apply",
  "static",
  "assets",
  "widget",
  "login",
]);

const PATTERNS: Array<{ provider: DiscoveredAtsProvider; regex: RegExp; region?: "eu" }> = [
  { provider: "ashby", regex: /jobs\.ashbyhq\.com\/([a-z0-9][a-z0-9._%-]*)/gi },
  { provider: "lever", regex: /(?<![a-z0-9.-])jobs\.lever\.co\/([a-z0-9][a-z0-9._%-]*)/gi },
  { provider: "lever", regex: /jobs\.eu\.lever\.co\/([a-z0-9][a-z0-9._%-]*)/gi, region: "eu" },
  { provider: "greenhouse", regex: /(?:job-)?boards\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9][a-z0-9._%-]*)/gi },
  { provider: "greenhouse", regex: /boards\.greenhouse\.io\/embed\/job_board(?:\/js)?\?for=([a-z0-9][a-z0-9._%-]*)/gi },
];

/** ATS board references found anywhere in an HTML document (links, iframes, scripts). */
export function extractAtsCandidates(html: string): Candidate[] {
  const $ = cheerio.load(html);
  const haystacks = [html];

  $("a[href], iframe[src], script[src]").each((_, element) => {
    const value = $(element).attr("href") ?? $(element).attr("src");

    if (value) {
      haystacks.push(value);
    }
  });

  const seen = new Set<string>();
  const found: Candidate[] = [];

  for (const haystack of haystacks) {
    for (const { provider, regex, region } of PATTERNS) {
      regex.lastIndex = 0;

      for (const match of haystack.matchAll(regex)) {
        const slug = decodeURIComponent(match[1]).replace(/[.]+$/, "").toLowerCase();
        const key = `${provider}:${region ?? ""}:${slug}`;

        if (slug && !IGNORED_SLUGS.has(slug) && !seen.has(key)) {
          seen.add(key);
          found.push({ provider, slug, region });
        }
      }
    }
  }

  return found;
}

/** Slugs a company might use on an ATS: domain label, name joined, name hyphenated. */
export function guessSlugs(name: string, website: string | null): string[] {
  const domain = extractDomain(website);
  const domainLabel = domain?.split(".")[0];
  const words = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const joined = normalizeCompanyName(name);
  const hyphenated = words.replace(/ /g, "-");
  const slugs = [domainLabel, joined, hyphenated].filter(
    (slug): slug is string => Boolean(slug) && (slug as string).length >= 2 && !IGNORED_SLUGS.has(slug as string),
  );

  return [...new Set(slugs)];
}

function boardUrlFor(candidate: Candidate) {
  switch (candidate.provider) {
    case "ashby":
      return `https://jobs.ashbyhq.com/${candidate.slug}`;
    case "lever":
      return `https://jobs.${candidate.region === "eu" ? "eu." : ""}lever.co/${candidate.slug}`;
    case "greenhouse":
      return `https://boards.greenhouse.io/${candidate.slug}`;
  }
}

function apiUrlFor(candidate: Candidate) {
  const slug = encodeURIComponent(candidate.slug);

  switch (candidate.provider) {
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    case "lever":
      return `https://api.${candidate.region === "eu" ? "eu." : ""}lever.co/v0/postings/${slug}?mode=json`;
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  }
}

/** Number of open jobs on the board, or null when the board does not exist. */
export async function countBoardJobs(
  candidate: Candidate,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<number | null> {
  const timeout = AbortSignal.timeout(API_TIMEOUT_MS);

  try {
    const response = await fetchImpl(apiUrlFor(candidate), {
      headers: { accept: "application/json", "user-agent": "JobTrackerRadar/1.0 (personal job search)" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as unknown;

    if (Array.isArray(data)) {
      return data.length;
    }

    if (data && typeof data === "object" && Array.isArray((data as { jobs?: unknown }).jobs)) {
      return (data as { jobs: unknown[] }).jobs.length;
    }

    return null;
  } catch {
    return null;
  }
}

async function defaultFetchPage(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const { bytes } = await fetchPublicResource(new URL(url), {
      accept: "text/html,application/xhtml+xml",
      maxBytes: MAX_PAGE_BYTES,
      signal: signal ?? new AbortController().signal,
      timeoutMs: 8_000,
    });

    return bytes.toString("utf8");
  } catch {
    return null;
  }
}

export async function discoverAts(
  company: { name: string; website: string | null },
  deps: AtsDiscoveryDeps = {},
): Promise<AtsDiscovery | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const fetchPage = deps.fetchPage ?? ((url: string) => defaultFetchPage(url, deps.signal));

  // 1. Links on the company's own site.
  if (company.website) {
    let base: URL | null = null;

    try {
      base = new URL(company.website);
    } catch {
      base = null;
    }

    if (base && (base.protocol === "http:" || base.protocol === "https:")) {
      const tried = new Set<string>();

      for (const path of CAREER_PATHS) {
        if (deps.signal?.aborted) {
          return null;
        }

        const url = new URL(path || "/", base).toString();

        if (tried.has(url)) {
          continue;
        }

        tried.add(url);

        const html = await fetchPage(url);

        if (!html) {
          continue;
        }

        for (const candidate of extractAtsCandidates(html)) {
          const jobsCount = await countBoardJobs(candidate, fetchImpl, deps.signal);

          // A linked board is accepted even when it has no open jobs today.
          if (jobsCount !== null) {
            return {
              provider: candidate.provider,
              boardUrl: boardUrlFor(candidate),
              slug: candidate.slug,
              jobsCount,
              via: "link",
            };
          }
        }
      }
    }
  }

  // 2. Guess the slug on each ATS: a board with open jobs is accepted.
  for (const slug of guessSlugs(company.name, company.website)) {
    for (const provider of ["ashby", "lever", "greenhouse"] as const) {
      if (deps.signal?.aborted) {
        return null;
      }

      const candidate: Candidate = { provider, slug };
      const jobsCount = await countBoardJobs(candidate, fetchImpl, deps.signal);

      if (jobsCount !== null && jobsCount > 0) {
        return { provider, boardUrl: boardUrlFor(candidate), slug, jobsCount, via: "slug" };
      }
    }
  }

  return null;
}
