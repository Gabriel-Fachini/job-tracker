import { cleanString, getJson, positiveNumber } from "./http";
import type {
  SourceFetchOptions,
  SourceFetchResult,
  SourceJob,
  SourceSalaryPeriod,
} from "./types";

const API_URL = "https://himalayas.app/jobs/api";
/** The API serves at most 20 vacancies per page. */
const PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 15;

type HimalayasJob = {
  title?: string;
  companyName?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null;
  currency?: string | null;
  seniority?: string[] | null;
  locationRestrictions?: string[] | null;
  timezoneRestrictions?: number[] | null;
  description?: string | null;
  excerpt?: string | null;
  /** Unix seconds. */
  pubDate?: number;
  applicationLink?: string;
  guid?: string;
};

type HimalayasResponse = {
  jobs?: HimalayasJob[];
  nextCursor?: string | null;
};

/**
 * Himalayas: cursor pagination, newest first. Stops at the first vacancy that is
 * not newer than the previous run's cursor (its newest `pubDate`, Unix seconds).
 */
export async function fetchHimalayasJobs(
  options: SourceFetchOptions = {},
): Promise<SourceFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxPages = options.config?.maxPages ?? DEFAULT_MAX_PAGES;
  const previous = Number(options.cursor);
  const previousCursor = Number.isFinite(previous) && previous > 0 ? previous : null;

  const jobs: SourceJob[] = [];
  let newest = previousCursor ?? 0;
  let pageCursor: string | null = null;
  let reachedKnown = false;

  for (let page = 0; page < maxPages && !reachedKnown; page += 1) {
    const url = new URL(API_URL);
    url.searchParams.set("limit", String(PAGE_SIZE));

    if (pageCursor) {
      url.searchParams.set("cursor", pageCursor);
    }

    const data = await getJson<HimalayasResponse>(url.toString(), fetchImpl, options.signal);
    const items = data.jobs ?? [];

    for (const item of items) {
      const published = typeof item.pubDate === "number" ? item.pubDate : 0;

      if (previousCursor !== null && published > 0 && published <= previousCursor) {
        reachedKnown = true;
        break;
      }

      newest = Math.max(newest, published);

      const job = mapHimalayasJob(item);

      if (job) {
        jobs.push(job);
      }
    }

    pageCursor = data.nextCursor ?? null;

    if (!pageCursor || items.length === 0) {
      break;
    }
  }

  return { jobs, cursor: newest > 0 ? String(newest) : (options.cursor ?? null) };
}

export function mapHimalayasJob(item: HimalayasJob): SourceJob | null {
  const title = cleanString(item.title);
  const companyName = cleanString(item.companyName);
  const url = cleanString(item.guid) ?? cleanString(item.applicationLink);

  if (!title || !companyName || !url) {
    return null;
  }

  const min = positiveNumber(item.minSalary);
  const max = positiveNumber(item.maxSalary);
  const restrictions = (item.locationRestrictions ?? []).map((value) => value.trim()).filter(Boolean);

  return {
    sourceKind: "himalayas",
    externalId: url,
    url,
    applyUrl: cleanString(item.applicationLink) && item.applicationLink !== url ? item.applicationLink : undefined,
    title,
    companyName,
    descriptionHtml: cleanString(item.description),
    descriptionText: item.description ? undefined : cleanString(item.excerpt),
    locationText: restrictions.length > 0 ? restrictions.join(", ") : "Remote (worldwide or timezone-based)",
    locationRestrictions: restrictions,
    timezoneRestrictions: Array.isArray(item.timezoneRestrictions)
      ? item.timezoneRestrictions.filter((value) => typeof value === "number")
      : undefined,
    salary:
      min || max
        ? {
            min,
            max,
            currency: cleanString(item.currency)?.toUpperCase(),
            period: mapPeriod(item.salaryPeriod),
          }
        : undefined,
    seniority: item.seniority?.[0]?.toLowerCase(),
    employmentType: cleanString(item.employmentType),
    publishedAt: item.pubDate ? new Date(item.pubDate * 1000) : undefined,
  };
}

function mapPeriod(period: string | null | undefined): SourceSalaryPeriod | undefined {
  const value = period?.toLowerCase() ?? "";

  if (value.startsWith("year") || value.startsWith("annual")) return "year";
  if (value.startsWith("month")) return "month";
  if (value.startsWith("hour")) return "hour";

  return undefined;
}
