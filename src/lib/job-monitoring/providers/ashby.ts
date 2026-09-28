import type { DiscoveredLink } from "../types";

const API_BASE = "https://api.ashbyhq.com/posting-api/job-board";
const MAX_LOCATIONS = 12;

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
  accept: "application/json",
};

type AshbySecondaryLocation = { location?: string | null };

type AshbyCompensationComponent = {
  compensationType?: string;
  interval?: string;
  currencyCode?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
};

export type AshbyJob = {
  id: string;
  title: string;
  location?: string | null;
  secondaryLocations?: AshbySecondaryLocation[];
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  publishedAt?: string;
  jobUrl: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: {
    scrapeableCompensationSalarySummary?: string | null;
    compensationTierSummary?: string | null;
    summaryComponents?: AshbyCompensationComponent[];
  } | null;
};

type AshbyBoardResponse = { jobs?: AshbyJob[] };

/** `https://jobs.ashbyhq.com/<org>[/...]` -> `<org>`. */
export function extractAshbyOrg(boardUrl: string): string | null {
  try {
    const url = new URL(boardUrl);

    if (url.hostname.toLowerCase() !== "jobs.ashbyhq.com") {
      return null;
    }

    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchAshbyJobs(
  boardUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscoveredLink[]> {
  const org = extractAshbyOrg(boardUrl);

  if (!org) {
    return [];
  }

  const response = await fetchImpl(
    `${API_BASE}/${encodeURIComponent(org)}?includeCompensation=true`,
    { headers: HEADERS, cache: "no-store" },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Ashby board inválido ou inacessível: ${org}`);
    }

    throw new Error(`Erro ao acessar Ashby API: ${response.status}`);
  }

  const data = (await response.json()) as AshbyBoardResponse;

  return (data.jobs ?? [])
    .filter((job) => job.isListed !== false && job.title && job.jobUrl)
    .map((job) => mapAshbyJob(job));
}

export function mapAshbyJob(job: AshbyJob): DiscoveredLink {
  const applyUrl = job.applyUrl && job.applyUrl !== job.jobUrl ? job.applyUrl : undefined;

  return {
    url: job.jobUrl,
    text: job.title,
    prefetched: {
      title: job.title,
      descriptionHtml: job.descriptionHtml ?? "",
      locationText: formatAshbyLocations(job),
      updatedAt: job.publishedAt,
      externalId: job.id,
      salaryText: formatAshbySalary(job.compensation) ?? undefined,
      workModel: mapAshbyWorkModel(job),
      applyUrl,
    },
  };
}

function formatAshbyLocations(job: AshbyJob): string | undefined {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const candidate of [
    job.location,
    ...(job.secondaryLocations ?? []).map((item) => item.location),
  ]) {
    const value = candidate?.trim();

    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      parts.push(value);
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  if (parts.length > MAX_LOCATIONS) {
    return `${parts.slice(0, MAX_LOCATIONS).join(", ")} (+${parts.length - MAX_LOCATIONS})`;
  }

  return parts.join(", ");
}

function mapAshbyWorkModel(job: AshbyJob): "remote" | "hybrid" | "onsite" | undefined {
  const workplace = job.workplaceType?.toLowerCase().replace(/[^a-z]/g, "");

  if (workplace === "remote") return "remote";
  if (workplace === "hybrid") return "hybrid";
  if (workplace === "onsite") return "onsite";

  if (job.isRemote === true) return "remote";

  return undefined;
}

function formatAshbySalary(compensation: AshbyJob["compensation"]): string | null {
  if (!compensation) {
    return null;
  }

  const summary = compensation.scrapeableCompensationSalarySummary?.trim();

  if (summary) {
    return summary;
  }

  const salary = compensation.summaryComponents?.find(
    (component) =>
      component.compensationType === "Salary" &&
      (component.minValue != null || component.maxValue != null),
  );

  if (salary) {
    const range =
      salary.minValue != null && salary.maxValue != null && salary.minValue !== salary.maxValue
        ? `${formatNumber(salary.minValue)}-${formatNumber(salary.maxValue)}`
        : formatNumber((salary.minValue ?? salary.maxValue) as number);
    const currency = salary.currencyCode ? `${salary.currencyCode} ` : "";
    const interval = salary.interval ? ` / ${humanizeAshbyInterval(salary.interval)}` : "";

    return `${currency}${range}${interval}`;
  }

  return compensation.compensationTierSummary?.trim() || null;
}

function humanizeAshbyInterval(interval: string) {
  const normalized = interval.toUpperCase();

  if (normalized.includes("YEAR")) return "year";
  if (normalized.includes("MONTH")) return "month";
  if (normalized.includes("HOUR")) return "hour";
  if (normalized.includes("WEEK")) return "week";

  return interval.toLowerCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
