import * as cheerio from "cheerio";

import { cleanString, getText } from "./http";
import type { SourceFetchOptions, SourceFetchResult, SourceJob } from "./types";

const FEED_BASE = "https://weworkremotely.com/categories";
const DEFAULT_CATEGORIES = ["remote-programming-jobs", "remote-devops-sysadmin-jobs"];

/** RSS per category, in sequence; the same vacancy in two categories is kept once. */
export async function fetchWeWorkRemotelyJobs(
  options: SourceFetchOptions = {},
): Promise<SourceFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const categories = options.config?.categories?.length
    ? options.config.categories
    : DEFAULT_CATEGORIES;
  const seen = new Set<string>();
  const jobs: SourceJob[] = [];
  let firstError: unknown = null;
  let succeeded = 0;

  for (const category of categories) {
    if (options.signal?.aborted) {
      break;
    }

    try {
      const xml = await getText(`${FEED_BASE}/${encodeURIComponent(category)}.rss`, fetchImpl, options.signal);

      for (const job of parseWeWorkRemotelyFeed(xml)) {
        if (!seen.has(job.externalId)) {
          seen.add(job.externalId);
          jobs.push(job);
        }
      }

      succeeded += 1;
    } catch (error) {
      firstError ??= error;
    }
  }

  // One broken category is tolerated; all of them failing is a source failure.
  if (succeeded === 0 && firstError) {
    throw firstError;
  }

  return { jobs };
}

export function parseWeWorkRemotelyFeed(xml: string): SourceJob[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const jobs: SourceJob[] = [];

  $("item").each((_, element) => {
    const item = $(element);
    const rawTitle = cleanString(item.children("title").first().text());
    const link = cleanString(item.children("link").first().text());
    const guid = cleanString(item.children("guid").first().text()) ?? link;

    if (!rawTitle || !link || !guid) {
      return;
    }

    const { company, title } = splitTitle(rawTitle);

    if (!company || !title) {
      return;
    }

    const region = cleanString(item.children("region").first().text());
    const published = cleanString(item.children("pubDate").first().text());
    const publishedAt = published ? new Date(published) : undefined;

    jobs.push({
      sourceKind: "weworkremotely",
      externalId: guid,
      url: link,
      title,
      companyName: company,
      descriptionHtml: cleanString(item.children("description").first().text()),
      locationText: region,
      locationRestrictions: region && !/anywhere|worldwide|global/i.test(region) ? [region] : [],
      employmentType: cleanString(item.children("type").first().text()),
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    });
  });

  return jobs;
}

/** "Company: Role" -> the first colon splits them ("Acme: Senior Dev: Payments" keeps the rest in the role). */
function splitTitle(value: string) {
  const index = value.indexOf(":");

  if (index <= 0) {
    return { company: null, title: null };
  }

  return {
    company: value.slice(0, index).trim(),
    title: value.slice(index + 1).trim(),
  };
}
