import { cleanString, getJson, positiveNumber } from "./http";
import type { SourceFetchOptions, SourceFetchResult, SourceJob } from "./types";

const API_URL = "https://remoteok.com/api";

type RemoteOkItem = {
  id?: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  apply_url?: string;
  url?: string;
  salary_min?: number;
  salary_max?: number;
};

/**
 * Remote OK: one JSON array whose first item is a legal notice. Its terms ask for
 * attribution, which the UI shows as "via Remote OK" with a link to `url`.
 */
export async function fetchRemoteOkJobs(
  options: SourceFetchOptions = {},
): Promise<SourceFetchResult> {
  const data = await getJson<RemoteOkItem[]>(API_URL, options.fetchImpl ?? fetch, options.signal);

  if (!Array.isArray(data)) {
    return { jobs: [] };
  }

  const jobs = data
    .slice(1)
    .map(mapRemoteOkJob)
    .filter((job): job is SourceJob => job !== null);

  return { jobs };
}

export function mapRemoteOkJob(item: RemoteOkItem): SourceJob | null {
  const title = cleanString(item.position);
  const companyName = cleanString(item.company);
  const url = cleanString(item.url) ?? cleanString(item.apply_url);
  const externalId = item.id !== undefined ? String(item.id) : cleanString(item.slug);

  if (!title || !companyName || !url || !externalId) {
    return null;
  }

  const min = positiveNumber(item.salary_min);
  const max = positiveNumber(item.salary_max);

  return {
    sourceKind: "remoteok",
    externalId,
    url,
    applyUrl: cleanString(item.apply_url) && item.apply_url !== url ? item.apply_url : undefined,
    title,
    companyName,
    descriptionHtml: cleanString(item.description),
    locationText: cleanString(item.location),
    // RemoteOK publishes yearly USD ranges.
    salary: min || max ? { min, max, currency: "USD", period: "year" } : undefined,
    publishedAt: item.epoch ? new Date(item.epoch * 1000) : item.date ? new Date(item.date) : undefined,
  };
}
