import { cleanString, getJson, positiveNumber } from "./http";
import type {
  SourceFetchOptions,
  SourceFetchResult,
  SourceJob,
  SourceSalaryPeriod,
} from "./types";

const API_URL = "https://jobicy.com/api/v2/remote-jobs";
const DEFAULT_COUNT = 50;
const DEFAULT_INDUSTRY = "dev";

type JobicyItem = {
  id?: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobType?: string[] | string;
  jobGeo?: string;
  jobLevel?: string;
  jobDescription?: string;
  jobExcerpt?: string;
  pubDate?: string;
  salaryMin?: number | string;
  salaryMax?: number | string;
  salaryCurrency?: string;
  salaryPeriod?: string;
};

type JobicyResponse = { jobs?: JobicyItem[] };

/**
 * Jobicy asks for credit to the source and for application buttons to point at
 * the original job URL: `url` is used as both the page and the apply link.
 */
export async function fetchJobicyJobs(
  options: SourceFetchOptions = {},
): Promise<SourceFetchResult> {
  const url = new URL(API_URL);
  url.searchParams.set("count", String(options.config?.count ?? DEFAULT_COUNT));

  const tags = options.config?.tags?.filter(Boolean) ?? [];

  if (tags.length > 0) {
    url.searchParams.set("tag", tags.join(","));
  } else {
    url.searchParams.set("industry", options.config?.industry ?? DEFAULT_INDUSTRY);
  }

  const data = await getJson<JobicyResponse>(url.toString(), options.fetchImpl ?? fetch, options.signal);
  const jobs = (data.jobs ?? [])
    .map(mapJobicyJob)
    .filter((job): job is SourceJob => job !== null);

  return { jobs };
}

export function mapJobicyJob(item: JobicyItem): SourceJob | null {
  const title = cleanString(item.jobTitle);
  const companyName = cleanString(item.companyName);
  const url = cleanString(item.url);

  if (!title || !companyName || !url || item.id === undefined) {
    return null;
  }

  const geo = cleanString(item.jobGeo);
  const restrictions = geo
    ? geo
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && !/^(anywhere|worldwide|global)$/i.test(part))
    : [];
  const min = positiveNumber(item.salaryMin);
  const max = positiveNumber(item.salaryMax);
  const published = item.pubDate ? new Date(item.pubDate) : undefined;

  return {
    sourceKind: "jobicy",
    externalId: String(item.id),
    url,
    applyUrl: url,
    title,
    companyName,
    descriptionHtml: cleanString(item.jobDescription),
    descriptionText: item.jobDescription ? undefined : cleanString(item.jobExcerpt),
    locationText: geo,
    locationRestrictions: restrictions,
    salary:
      min || max
        ? {
            min,
            max,
            currency: cleanString(item.salaryCurrency)?.toUpperCase(),
            period: mapPeriod(item.salaryPeriod),
          }
        : undefined,
    seniority: cleanString(item.jobLevel)?.toLowerCase(),
    employmentType: Array.isArray(item.jobType) ? item.jobType[0] : cleanString(item.jobType),
    publishedAt: published && !Number.isNaN(published.getTime()) ? published : undefined,
  };
}

function mapPeriod(period: string | undefined): SourceSalaryPeriod | undefined {
  const value = period?.toLowerCase() ?? "";

  if (value.startsWith("year") || value.startsWith("annual")) return "year";
  if (value.startsWith("month")) return "month";
  if (value.startsWith("hour")) return "hour";

  return undefined;
}
