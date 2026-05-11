import pLimit from "p-limit";
import type { DiscoveredLink } from "../types";

const DETAIL_CONCURRENCY = 5;
const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

const HEADERS = {
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
};

export function extractGupySlug(boardUrl: string): string | null {
  try {
    const url = new URL(boardUrl);
    const match = url.hostname.match(/^([^.]+)\.gupy\.io$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function parseNextData<T>(html: string): T | null {
  const m = html.match(NEXT_DATA_RE);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as T;
  } catch {
    return null;
  }
}

type GupyListJob = {
  id: number;
  title: string;
  department?: string;
  workplace?: { workplaceType?: string };
};

type GupyDetailJob = {
  id: number;
  name: string;
  description?: string;
  prerequisites?: string;
  responsibilities?: string;
  workplaceType?: string;
  status?: string;
  code?: string;
  publishedAt?: string;
};

function joinHtml(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join("\n");
}

export async function fetchGupyJobs(boardUrl: string): Promise<DiscoveredLink[]> {
  const slug = extractGupySlug(boardUrl);
  if (!slug) return [];

  const boardRes = await fetch(`https://${slug}.gupy.io/`, { headers: HEADERS });
  if (!boardRes.ok) {
    console.error(`[gupy] board ${boardRes.status} for ${slug}`);
    return [];
  }

  const html = await boardRes.text();
  const data = parseNextData<{ props: { pageProps: { jobs?: GupyListJob[] } } }>(html);
  const jobs = data?.props?.pageProps?.jobs ?? [];
  console.log(`[gupy] ${slug} → ${jobs.length} jobs in board`);

  const limit = pLimit(DETAIL_CONCURRENCY);
  return Promise.all(
    jobs.map((job) =>
      limit(async () => {
        const url = `https://${slug}.gupy.io/jobs/${job.id}?jobBoardSource=gupy_public_page`;
        try {
          const detailRes = await fetch(url, { headers: HEADERS });
          if (!detailRes.ok) throw new Error(`HTTP ${detailRes.status}`);

          const detailHtml = await detailRes.text();
          const parsed = parseNextData<{ props: { pageProps: { job?: GupyDetailJob } } }>(detailHtml);
          const detail = parsed?.props?.pageProps?.job;
          if (!detail) throw new Error("no job in __NEXT_DATA__");

          if (detail.status && detail.status !== "published") {
            return null;
          }

          const descriptionHtml = joinHtml(
            detail.description,
            detail.responsibilities,
            detail.prerequisites,
          );

          return {
            url,
            text: detail.name,
            prefetched: {
              title: detail.name,
              descriptionHtml,
              externalId: String(detail.id),
            },
          } as DiscoveredLink;
        } catch (err) {
          console.warn(`[gupy] detail failed ${job.id}: ${(err as Error).message}`);
          return { url, text: job.title } as DiscoveredLink;
        }
      }),
    ),
  ).then((arr) => arr.filter(Boolean) as DiscoveredLink[]);
}
