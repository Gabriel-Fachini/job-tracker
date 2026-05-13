import pLimit from "p-limit";

import type { DiscoveredLink } from "../types";

const DETAIL_CONCURRENCY = 5;

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
};

type GreenhouseJobsResponse = {
  jobs: Array<{
    id: number;
    title: string;
    updated_at: string;
    location?: { name: string };
    absolute_url: string;
    departments?: Array<{ name: string }>;
    offices?: Array<{ name: string; location: string }>;
  }>;
  meta?: { total: number };
};

type GreenhouseJobDetail = {
  id: number;
  title: string;
  content: string;
  updated_at: string;
  location?: { name: string };
  absolute_url: string;
  departments?: Array<{ name: string }>;
  offices?: Array<{ name: string; location: string }>;
};

export async function fetchGreenhouseJobs(
  boardToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscoveredLink[]> {
  // Phase 1: list all jobs — no ?content=true, always valid JSON
  const listUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;

  const listResponse = await fetchImpl(listUrl, {
    headers: HEADERS,
    cache: "no-store",
  });

  if (!listResponse.ok) {
    if (listResponse.status === 404) {
      throw new Error(
        `Greenhouse board token inválido ou inacessível: ${boardToken}`,
      );
    }
    throw new Error(`Erro ao acessar Greenhouse API: ${listResponse.status}`);
  }

  const data: GreenhouseJobsResponse = await listResponse.json();

  if (!data.jobs?.length) {
    return [];
  }

  // Phase 2: fetch content per job in parallel — individual endpoints return valid JSON
  const limit = pLimit(DETAIL_CONCURRENCY);

  return Promise.all(
    data.jobs.map((job) =>
      limit(async () => {
        const detailUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${job.id}`;
        try {
          const detailRes = await fetchImpl(detailUrl, {
            headers: HEADERS,
            cache: "no-store",
          });

          if (!detailRes.ok) {
            throw new Error(`HTTP ${detailRes.status}`);
          }

          const detail: GreenhouseJobDetail = await detailRes.json();

          return {
            url: job.absolute_url,
            text: job.title,
            prefetched: {
              title: job.title,
              descriptionHtml: decodeHtmlEntities(detail.content || ""),
              locationText: formatLocations(job.location, job.offices),
              departments: job.departments?.map((d) => d.name),
              offices: job.offices?.map((o) => o.name),
              updatedAt: job.updated_at,
              externalId: String(job.id),
            },
          } satisfies DiscoveredLink;
        } catch {
          return { url: job.absolute_url, text: job.title } satisfies DiscoveredLink;
        }
      }),
    ),
  );
}

// Greenhouse API returns HTML-encoded content (e.g. &lt;h2&gt; instead of <h2>).
// Single-pass decode so htmlToMarkdown/Turndown receives actual HTML structure.
function decodeHtmlEntities(encoded: string): string {
  return encoded.replace(
    /&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-f]+));/gi,
    (match, dec, hex) => {
      if (dec !== undefined) return String.fromCharCode(parseInt(dec, 10));
      if (hex !== undefined) return String.fromCharCode(parseInt(hex, 16));
      const map: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
      };
      return map[match] ?? match;
    },
  );
}

function formatLocations(
  location: { name: string } | undefined,
  offices: Array<{ name: string; location: string }> | undefined,
): string | undefined {
  const parts: string[] = [];

  if (location?.name) {
    parts.push(location.name);
  }

  if (offices && offices.length > 0) {
    const officeNames = offices.map((o) => o.name).filter(Boolean);
    if (officeNames.length > 0 && !parts.includes(officeNames[0])) {
      parts.push(...officeNames);
    }
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function extractGreenhouseBoardToken(jobsBoardUrl: string): string | null {
  try {
    const url = new URL(jobsBoardUrl);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (
      (url.hostname.includes("boards.greenhouse.io") ||
        url.hostname.includes("job-boards.greenhouse.io")) &&
      pathSegments.length > 0
    ) {
      return pathSegments[0];
    }

    return null;
  } catch {
    return null;
  }
}
