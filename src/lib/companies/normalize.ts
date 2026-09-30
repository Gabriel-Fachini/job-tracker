import { createHash } from "node:crypto";

const COMPANY_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "gmbh",
  "sa",
  "corp",
  "corporation",
  "co",
  "plc",
]);

/** `Modash.io` -> `Modash`: a domain-like ending is not part of the name. */
const DOMAIN_ENDING = /\.(io|ai|com|app|dev|co|xyz|net|org|so|sh|tech)\b/gi;

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Comparable company name: lowercase, no accents or punctuation, no legal
 * suffix (`inc`, `llc`, `ltd`, `gmbh`, `s.a.`, `corp`, `co`) and no spaces, so
 * "Open AI, Inc." and "OpenAI" meet.
 */
export function normalizeCompanyName(name: string): string {
  const cleaned = stripDiacritics(name)
    .toLowerCase()
    .replace(/\bs\.\s?a\.?(?=\s|$)/g, " sa ")
    .replace(DOMAIN_ENDING, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  let tokens = cleaned.split(" ").filter(Boolean);

  if (tokens[0] === "the" && tokens.length > 1) {
    tokens = tokens.slice(1);
  }

  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -1);
  }

  return tokens.join("");
}

const SECOND_LEVEL_LABELS = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);

/** Registrable domain of a URL (`https://www.acme.co.uk/x` -> `acme.co.uk`), or null. */
export function extractDomain(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  let hostname: string;

  try {
    const raw = value.trim();
    hostname = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }

  const labels = hostname.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);

  if (labels.length < 2) {
    return null;
  }

  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const keep = tld.length === 2 && SECOND_LEVEL_LABELS.has(second) && labels.length >= 3 ? 3 : 2;

  return labels.slice(-keep).join(".");
}

/** Domains shared by many companies: never a reason to merge two of them. */
const SHARED_DOMAINS = new Set([
  "linkedin.com",
  "github.com",
  "gitlab.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "medium.com",
  "notion.so",
  "notion.site",
  "google.com",
  "lever.co",
  "greenhouse.io",
  "ashbyhq.com",
  "workable.com",
  "ycombinator.com",
  "himalayas.app",
  "remoteok.com",
  "weworkremotely.com",
  "jobicy.com",
  "wellfound.com",
  "angel.co",
  "bamboohr.com",
  "smartrecruiters.com",
  "myworkdayjobs.com",
]);

export function isMatchableDomain(domain: string | null): domain is string {
  return Boolean(domain) && !SHARED_DOMAINS.has(domain as string);
}

const TITLE_NOISE = new Set(["remote", "worldwide", "global", "anywhere", "hybrid", "wfh"]);

/** Title without accents, punctuation, bracketed notes and remote/worldwide words. */
export function normalizeTitleForDedup(title: string): string {
  return stripDiacritics(title)
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter((token) => token && !TITLE_NOISE.has(token))
    .join(" ");
}

/** Same company + same role from two sources share this key. */
export function buildDedupKey(companyName: string, title: string): string {
  const input = `${normalizeCompanyName(companyName)}|${normalizeTitleForDedup(title)}`;

  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/** Origin of the site as stored on a company (`https://acme.com`), or null. */
export function normalizeWebsiteOrigin(value: string | null | undefined): string | null {
  if (!value?.trim() || /^(mailto|tel|javascript):/i.test(value.trim())) {
    return null;
  }

  try {
    const raw = value.trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);

    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
