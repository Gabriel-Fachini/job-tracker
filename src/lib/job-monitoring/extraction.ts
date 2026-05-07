import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import { normalizeBrazilianJobText } from "./signals";
import type { ExtractedJobDetail, FetchLike } from "./types";

const CONTENT_SELECTORS = [
  "[itemprop='description']",
  "main",
  "article",
  "[role='main']",
  ".job-description",
  ".jobDescriptionContent",
  ".description",
];

export async function extractJobDetail(
  url: string,
  options: { fetchImpl?: FetchLike } = {},
): Promise<ExtractedJobDetail | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    headers: createRequestHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel ler a vaga com status ${response.status}.`);
  }

  const html = await response.text();
  return extractJobDetailFromHtml(url, html);
}

export function extractJobDetailFromHtml(
  url: string,
  html: string,
): ExtractedJobDetail | null {
  const $ = cheerio.load(html);
  const jobPosting = extractJobPostingJsonLd($);
  prepareDocument($);
  const title =
    normalizeWhitespace(jobPosting?.title) ||
    normalizeWhitespace($("h1").first().text()) ||
    normalizeWhitespace($("meta[property='og:title']").attr("content")) ||
    normalizeWhitespace($("title").first().text()) ||
    null;
  const description = finalizeDescription(
    jobPosting?.description ?? extractPrimaryDescription($),
    title,
  );

  if (!title && !description) {
    return null;
  }

  const locationText =
    normalizeWhitespace(jobPosting?.jobLocation) ||
    normalizeWhitespace($("meta[property='og:locality']").attr("content")) ||
    null;
  const salaryText = normalizeWhitespace(jobPosting?.baseSalary) || null;

  return {
    title,
    description,
    sourceUrl: url,
    sourceName: detectSourceName(url),
    workModel: detectWorkModel(title, description),
    seniority: detectSeniority(title, description),
    locationText,
    salaryText,
  };
}

type JobPostingJsonLd = {
  title: string | null;
  description: string | null;
  jobLocation: string | null;
  baseSalary: string | null;
};

function extractJobPostingJsonLd($: cheerio.CheerioAPI): JobPostingJsonLd | null {
  const scripts = $("script[type='application/ld+json']").toArray();

  for (const script of scripts) {
    const raw = $(script).contents().text().trim();

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(decodeHtmlEntities(raw)) as unknown;
      const candidate = findJobPosting(parsed);

      if (!candidate) {
        continue;
      }

      return {
        title: cleanRichText(getString(candidate, "title")),
        description: cleanRichText(getString(candidate, "description")),
        jobLocation: readJobLocation(candidate),
        baseSalary: readSalary(candidate),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findJobPosting(item);
      if (match) {
        return match;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;

  if (normalizeType(record["@type"]) === "jobposting") {
    return record;
  }

  if (record["@graph"]) {
    return findJobPosting(record["@graph"]);
  }

  if (record.mainEntity) {
    return findJobPosting(record.mainEntity);
  }

  return null;
}

function normalizeType(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function readJobLocation(record: Record<string, unknown>): string | null {
  const location = record.jobLocation;

  if (Array.isArray(location)) {
    return location
      .map((item) => readJobLocation({ jobLocation: item }))
      .filter(Boolean)
      .join(" / ");
  }

  if (!location || typeof location !== "object") {
    return null;
  }

  const address = (location as Record<string, unknown>).address;

  if (!address || typeof address !== "object") {
    return null;
  }

  const parts = [
    getString(address as Record<string, unknown>, "addressLocality"),
    getString(address as Record<string, unknown>, "addressRegion"),
    getString(address as Record<string, unknown>, "addressCountry"),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function readSalary(record: Record<string, unknown>): string | null {
  const salary = record.baseSalary;

  if (!salary || typeof salary !== "object") {
    return null;
  }

  const value = (salary as Record<string, unknown>).value;

  if (!value || typeof value !== "object") {
    return null;
  }

  const min = getNumber(value as Record<string, unknown>, "minValue");
  const max = getNumber(value as Record<string, unknown>, "maxValue");
  const currency = getString(value as Record<string, unknown>, "currency") ?? "BRL";

  if (min === null && max === null) {
    return null;
  }

  if (min !== null && max !== null) {
    return `${currency} ${min} - ${max}`;
  }

  return `${currency} ${min ?? max}`;
}

function extractPrimaryDescription($: cheerio.CheerioAPI) {
  for (const selector of CONTENT_SELECTORS) {
    const text = extractReadableText($(selector).first());

    if (text.length >= 120) {
      return text;
    }
  }

  let bestCandidate = "";

  $("section, div").each((_, element) => {
    const text = extractReadableText($(element));

    if (text.length > bestCandidate.length && isLikelyReadableContent(text)) {
      bestCandidate = text;
    }
  });

  return bestCandidate;
}

function detectSourceName(url: string) {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("linkedin.com")) {
    return "linkedin";
  }

  if (hostname.includes("gupy.io")) {
    return "gupy";
  }

  return "company_site";
}

function detectWorkModel(title: string | null, description: string | null) {
  const text = normalizeBrazilianJobText(`${title ?? ""} ${description ?? ""}`);
  const detected = new Set<string>();

  if (/\b(hibrido|hibrida|hybrid)\b/.test(text)) {
    detected.add("hybrid");
  }

  if (/\b(presencial|onsite|on-site|in office)\b/.test(text)) {
    detected.add("onsite");
  }

  if (/\b(remoto|remota|remote|home office|work from home|anywhere)\b/.test(text)) {
    detected.add("remote");
  }

  return detected.size === 1 ? [...detected][0]! : null;
}

function detectSeniority(title: string | null, description: string | null) {
  const text = normalizeBrazilianJobText(`${title ?? ""} ${description ?? ""}`);

  if (/\b(estagio|estagiario|internship|intern)\b/.test(text)) {
    return "intern";
  }

  if (/\b(junior|junior|jr|trainee|entry level)\b/.test(text)) {
    return "junior";
  }

  if (/\b(pleno|mid|mid-level|middle)\b/.test(text)) {
    return "mid";
  }

  if (/\b(senior|sr|especialista)\b/.test(text)) {
    return "senior";
  }

  if (/\bstaff\b/.test(text)) {
    return "staff";
  }

  if (/\b(lead|lider tecnico|lider)\b/.test(text)) {
    return "lead";
  }

  return null;
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function getNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function prepareDocument($: cheerio.CheerioAPI) {
  $("script, style, noscript, template, svg").remove();
}

function extractReadableText(node: cheerio.Cheerio<AnyNode>) {
  return cleanRichText(node.html() ?? node.text()) ?? "";
}

function cleanRichText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const decoded = decodeHtmlEntities(value);
  const $ = cheerio.load(`<body>${decoded}</body>`);
  $("script, style, noscript, template, svg").remove();
  const text = normalizeWhitespace($("body").text());
  return text || null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function isLikelyReadableContent(text: string) {
  if (text.length < 120) {
    return false;
  }

  const cssTokenCount = (text.match(/[{};]/g) ?? []).length;
  return cssTokenCount <= Math.floor(text.length / 80);
}

function finalizeDescription(value: string | null | undefined, title: string | null) {
  let text = normalizeWhitespace(value);

  if (!text) {
    return null;
  }

  for (const marker of ["Descrição da vaga", "Descricao da vaga", "Job description"]) {
    const index = text.indexOf(marker);

    if (index >= 0 && index <= 400) {
      text = text.slice(index).trim();
      break;
    }
  }

  if (title && text.startsWith(title)) {
    text = text.slice(title.length).trim();
  }

  return text || null;
}

function createRequestHeaders() {
  return {
    "user-agent":
      "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  };
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
