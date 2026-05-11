import pLimit from "p-limit";
import type { DiscoveredLink } from "../types";

const API_BASE = "https://api.inhire.app";
const DETAIL_CONCURRENCY = 5;

const REQUEST_HEADERS = (slug: string) => ({
  "X-Tenant": slug,
  "Accept": "application/json, text/plain, */*",
  "Referer": `https://${slug}.inhire.app/`,
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
});

function parseJsonResponse<T>(raw: string): T {
  return JSON.parse(raw);
}

export function extractInhireSlug(boardUrl: string): string | null {
  try {
    const url = new URL(boardUrl);
    const match = url.hostname.match(/^([^.]+)\.inhire\.app$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function fetchInhireJobs(boardUrl: string): Promise<DiscoveredLink[]> {
  const slug = extractInhireSlug(boardUrl);
  if (!slug) return [];

  const listRes = await fetch(`${API_BASE}/job-posts/public/pages`, {
    headers: REQUEST_HEADERS(slug),
  });
  if (!listRes.ok) {
    console.error(`[inhire] listing ${listRes.status} for ${slug}`);
    return [];
  }

  const list = parseJsonResponse<{
    jobsPage: Array<{
      jobId: string;
      displayName: string;
      status: string;
      location: string;
      workplaceType: string;
      careerPageId: string;
    }>;
  }>(await listRes.text());

  const published = (list.jobsPage ?? []).filter((j) => j.status === "published");
  console.log(`[inhire] ${slug} → ${published.length} published jobs`);

  const limit = pLimit(DETAIL_CONCURRENCY);
  const links = await Promise.all(
    published.map((job) =>
      limit(async () => {
        const detailUrl = `${API_BASE}/job-posts/public/pages/${job.jobId}`;
        const url = `https://${slug}.inhire.app/vagas/${job.jobId}`;
        try {
          const detailRes = await fetch(detailUrl, { headers: REQUEST_HEADERS(slug) });
          if (!detailRes.ok) throw new Error(`HTTP ${detailRes.status}`);

          const detail = parseJsonResponse<{
            displayName: string;
            description: string;
            location: string;
            workplaceType: string;
            contractType: string[];
            publishedAt?: string;
          }>(await detailRes.text());

          return {
            url,
            text: detail.displayName,
            prefetched: {
              title: detail.displayName,
              descriptionHtml: detail.description ?? "",
              externalId: job.jobId,
            },
          } satisfies DiscoveredLink;
        } catch (err) {
          console.warn(`[inhire] detail failed ${job.jobId}: ${(err as Error).message}`);
          return { url, text: job.displayName } satisfies DiscoveredLink;
        }
      }),
    ),
  );

  return links;
}
