import * as cheerio from "cheerio";

import { cleanString, getJson } from "./http";
import type { SourceFetchOptions, SourceFetchResult, SourceJob } from "./types";

const SEARCH_URL =
  "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10";
const ITEM_URL = "https://hn.algolia.com/api/v1/items";
const COMMENT_URL = "https://news.ycombinator.com/item?id=";
const FALLBACK_TITLE = "Vaga (HN)";

type HnSearchResponse = {
  hits?: Array<{ objectID: string; title?: string; created_at?: string }>;
};

type HnComment = {
  id: number;
  author?: string | null;
  text?: string | null;
  created_at?: string;
  children?: unknown[];
};

type HnItemResponse = {
  id: number;
  children?: HnComment[];
};

/**
 * "Ask HN: Who is hiring?": the latest monthly thread. Only top-level comments
 * that mention "remote" become vacancies; replies are ignored. Comments are
 * skipped on later runs through their URL (the thread keeps growing all month).
 */
export async function fetchHnWhoIsHiringJobs(
  options: SourceFetchOptions = {},
): Promise<SourceFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const search = await getJson<HnSearchResponse>(SEARCH_URL, fetchImpl, options.signal);
  const thread = (search.hits ?? [])
    .filter((hit) => /who is hiring/i.test(hit.title ?? ""))
    .sort((left, right) => Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? ""))[0];

  if (!thread) {
    return { jobs: [] };
  }

  const item = await getJson<HnItemResponse>(`${ITEM_URL}/${thread.objectID}`, fetchImpl, options.signal);
  const jobs = (item.children ?? [])
    .map((comment) => mapHnComment(comment))
    .filter((job): job is SourceJob => job !== null);

  return { jobs, cursor: thread.objectID };
}

export function mapHnComment(comment: HnComment): SourceJob | null {
  const html = cleanString(comment.text);

  if (!html || !comment.id) {
    return null;
  }

  const fullText = cheerio.load(`<div>${html}</div>`)("div").text();

  if (!/remote/i.test(fullText)) {
    return null;
  }

  const header = parseHnHeader(firstLineOf(html));

  if (!header) {
    return null;
  }

  const created = comment.created_at ? new Date(comment.created_at) : undefined;

  return {
    sourceKind: "hn_whoishiring",
    externalId: String(comment.id),
    url: `${COMMENT_URL}${comment.id}`,
    title: header.title,
    companyName: header.company,
    companyWebsite: header.website,
    descriptionHtml: html,
    locationText: header.location,
    publishedAt: created && !Number.isNaN(created.getTime()) ? created : undefined,
  };
}

/** The comment's first line, as HTML (HN separates paragraphs with <p>). */
function firstLineOf(html: string) {
  const index = html.search(/<p>/i);

  return index === -1 ? html : html.slice(0, index);
}

export type HnHeader = {
  company: string;
  title: string;
  location?: string;
  website?: string;
};

const NOT_A_TITLE =
  /^(remote|onsite|on-site|hybrid|full[- ]?time|part[- ]?time|contract|intern(ship)?|https?:|www\.|\$|€|£|visa|relocation)/i;
const LOCATION_HINT = /remote|onsite|on-site|hybrid|\b[A-Z]{2}\b|europe|americas|worldwide|anywhere|usa|\bus\b|canada|latam/i;

/**
 * `Company | Role | Location | ...`. Returns null when there is no company
 * (empty line). When the second segment is not a role, the title falls back
 * to "Vaga (HN)" and the company stays the first segment.
 */
export function parseHnHeader(lineHtml: string): HnHeader | null {
  const $ = cheerio.load(`<div>${lineHtml}</div>`);
  const website = $("a[href]").first().attr("href");
  const text = $("div").text().replace(/\s+/g, " ").trim();
  const segments = text
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const company = segments[0];

  if (!company || company.length > 120) {
    return null;
  }

  const second = segments[1];
  const title = second && !NOT_A_TITLE.test(second) && second.length <= 160 ? second : FALLBACK_TITLE;
  const rest = title === FALLBACK_TITLE ? segments.slice(1) : segments.slice(2);
  const location = rest.find((segment) => LOCATION_HINT.test(segment) && segment.length <= 120);

  return {
    company,
    title,
    location,
    website: website && /^https?:\/\//i.test(website) ? website : undefined,
  };
}
