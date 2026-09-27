import "server-only";

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { BlockList, isIP } from "node:net";
import path from "node:path";

import * as cheerio from "cheerio";
import { and, eq, isNull } from "drizzle-orm";

import { getUploadsRoot } from "@/lib/applications/resume-upload";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

/**
 * Company logos, looked up on the company's own site (no third-party logo
 * service) the first time a row asks for one, then served from
 * `<UPLOADS_PATH>/logos`. A site without a usable icon is asked again only
 * after RETRY_AFTER_MS; editing the site or the logo URL resets the cache.
 */

/** `cover` fills the tile (apple-touch icons are opaque squares); `contain` pads it. */
export type CompanyLogoFit = "cover" | "contain";

export type CompanyLogoView = {
  /** Null renders the monogram. */
  src: string | null;
  /** Not looked up yet: requesting `src` does the lookup, so it may still 404. */
  pending: boolean;
  fit: CompanyLogoFit;
};

type CompanyLogoSource = {
  id: number;
  website: string | null;
  logoUrl: string | null;
  logoPath: string | null;
  logoCheckedAt: Date | null;
};

type StoredLogo = {
  bytes: Buffer;
  contentType: string;
  version: string;
};

type IconCandidate = {
  url: string;
  fit: CompanyLogoFit;
};

const LOGO_DIRECTORY = "logos";
/** A site that answered but has no usable icon. */
const RETRY_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
/** Timeouts, network errors, 429 and 5xx: likely gone by the next visit. */
const TRANSIENT_RETRY_AFTER_MS = 30 * 60 * 1000;
// Pending logos hold a browser connection while they resolve; keep it short.
const LOOKUP_DEADLINE_MS = 10_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 4;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_CANDIDATES = 5;
/** Smaller than this is a tracking pixel or a placeholder, not a logo. */
const MIN_ICON_SIZE = 16;
const USER_AGENT =
  "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)";

const IMAGE_FORMATS = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  svg: "image/svg+xml",
} as const;

type ImageFormat = keyof typeof IMAGE_FORMATS;

// `<id>-<content hash>[-cover].<ext>`: the hash doubles as the cache version.
const LOGO_FILE_PATTERN = /^(\d+)-([a-f0-9]{12})(-cover)?\.(png|jpg|gif|webp|avif|ico|svg)$/;

const inflightLookups = new Map<number, Promise<StoredLogo | null>>();

/** What a list row renders. No I/O: pending logos resolve when the image is requested. */
export function getCompanyLogoView(company: CompanyLogoSource): CompanyLogoView {
  const stored = company.logoPath ? parseLogoFileName(company.logoPath) : null;

  if (stored) {
    return {
      src: `/api/companies/${company.id}/logo?v=${stored.version}`,
      pending: false,
      fit: stored.fit,
    };
  }

  if (!isLookupDue(company)) {
    return { src: null, pending: false, fit: "contain" };
  }

  return { src: `/api/companies/${company.id}/logo`, pending: true, fit: "contain" };
}

/** The cached logo, looked up on the company's site when there is none yet. */
export async function readCompanyLogo(companyId: number): Promise<StoredLogo | null> {
  const company = db
    .select({
      id: companies.id,
      website: companies.website,
      logoUrl: companies.logoUrl,
      logoPath: companies.logoPath,
      logoCheckedAt: companies.logoCheckedAt,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!company) {
    return null;
  }

  if (company.logoPath) {
    const stored = await readStoredLogo(company.logoPath);

    if (stored) {
      return stored;
    }
    // The file is gone (uploads wiped, database restored): look it up again.
  } else if (!isLookupDue(company)) {
    return null;
  }

  let lookupPromise = inflightLookups.get(company.id);

  if (!lookupPromise) {
    lookupPromise = lookUpAndStore(company).finally(() => {
      inflightLookups.delete(company.id);
    });
    inflightLookups.set(company.id, lookupPromise);
  }

  return lookupPromise;
}

export async function removeCompanyLogoFile(fileName: string | null) {
  if (!fileName || !parseLogoFileName(fileName)) {
    return;
  }

  await unlink(path.join(getLogoDirectory(), fileName)).catch(() => undefined);
}

function isLookupDue(company: CompanyLogoSource) {
  if (!company.logoUrl && !company.website) {
    return false;
  }

  return (
    !company.logoCheckedAt ||
    Date.now() - company.logoCheckedAt.getTime() >= RETRY_AFTER_MS
  );
}

async function lookUpAndStore(company: CompanyLogoSource): Promise<StoredLogo | null> {
  const signal = AbortSignal.timeout(LOOKUP_DEADLINE_MS);
  const discovery = company.logoUrl
    ? { candidates: [{ url: company.logoUrl, fit: "contain" as const }], transient: false }
    : company.website
      ? await findIconCandidates(company.website, signal)
      : { candidates: [], transient: false };

  let found: { bytes: Buffer; format: ImageFormat; fit: CompanyLogoFit } | null = null;
  let transient = discovery.transient;

  for (const candidate of discovery.candidates.slice(0, MAX_CANDIDATES)) {
    if (signal.aborted) {
      transient = true;
      break;
    }

    const image = await downloadImage(candidate.url, signal).catch((error: unknown) => {
      transient ||= isTransientError(error);
      return null;
    });

    if (image) {
      found = { ...image, fit: candidate.fit };
      break;
    }
  }

  // The site or the logo URL may change while this runs; a result for the old
  // source must not overwrite the reset done by the edit.
  const sameSource = and(
    eq(companies.id, company.id),
    company.website === null
      ? isNull(companies.website)
      : eq(companies.website, company.website),
    company.logoUrl === null
      ? isNull(companies.logoUrl)
      : eq(companies.logoUrl, company.logoUrl),
  );

  if (!found) {
    // A hiccup is recorded as an older check, so the lookup is due again in
    // TRANSIENT_RETRY_AFTER_MS instead of RETRY_AFTER_MS.
    const checkedAt = transient
      ? new Date(Date.now() - RETRY_AFTER_MS + TRANSIENT_RETRY_AFTER_MS)
      : new Date();

    db.update(companies)
      .set({ logoPath: null, logoCheckedAt: checkedAt })
      .where(sameSource)
      .run();

    return null;
  }

  const version = createHash("sha256").update(found.bytes).digest("hex").slice(0, 12);
  const fileName = `${company.id}-${version}${found.fit === "cover" ? "-cover" : ""}.${found.format}`;
  const directory = getLogoDirectory();

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), found.bytes);

  const { changes } = db
    .update(companies)
    .set({ logoPath: fileName, logoCheckedAt: new Date() })
    .where(sameSource)
    .run();

  if (changes === 0) {
    await removeCompanyLogoFile(fileName);
    return null;
  }

  if (company.logoPath && company.logoPath !== fileName) {
    await removeCompanyLogoFile(company.logoPath);
  }

  return { bytes: found.bytes, contentType: IMAGE_FORMATS[found.format], version };
}

async function findIconCandidates(website: string, signal: AbortSignal) {
  let base: URL;

  try {
    base = new URL(website);
  } catch {
    return { candidates: [], transient: false };
  }

  const found: Array<IconCandidate & { score: number }> = [];
  let transient = false;

  try {
    const page = await fetchPublicResource(base, {
      accept: "text/html,application/xhtml+xml",
      maxBytes: MAX_PAGE_BYTES,
      signal,
    });
    base = page.url;

    const $ = cheerio.load(page.bytes.toString("utf8"));
    const documentBase = resolveDocumentBase($("base[href]").attr("href"), base);

    $("link[rel][href]").each((_, element) => {
      const link = $(element);
      const rel = (link.attr("rel") ?? "").toLowerCase().split(/\s+/);
      const url = toHttpUrl(link.attr("href"), documentBase);

      if (!url) {
        return;
      }

      const size = largestDeclaredSize(link.attr("sizes"));

      if (rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed")) {
        found.push({ url: url.href, fit: "cover", score: 3000 + (size ?? 180) });
        return;
      }

      if (!rel.includes("icon")) {
        return;
      }

      const isSvg =
        (link.attr("type") ?? "").toLowerCase() === "image/svg+xml" ||
        url.pathname.toLowerCase().endsWith(".svg");

      // SVG icons scale, but many switch colors with the OS theme, which the
      // app's own theme can't follow. A decent raster icon goes first.
      const score = isSvg
        ? 1500
        : (size ?? 0) >= 96
          ? 2000 + (size ?? 0)
          : 1000 + (size ?? MIN_ICON_SIZE);

      found.push({ url: url.href, fit: "contain", score });
    });
  } catch (error) {
    // Unreachable or bot-blocked page: the conventional paths below may still work.
    transient = isTransientError(error);
  }

  // Served by many sites without a <link> tag.
  found.push({ url: new URL("/apple-touch-icon.png", base).href, fit: "cover", score: 2500 });
  found.push({ url: new URL("/favicon.ico", base).href, fit: "contain", score: 500 });

  const seen = new Set<string>();
  const candidates = found
    .sort((left, right) => right.score - left.score)
    .filter((candidate) => {
      if (seen.has(candidate.url)) {
        return false;
      }

      seen.add(candidate.url);
      return true;
    })
    .map(({ url, fit }): IconCandidate => ({ url, fit }));

  return { candidates, transient };
}

async function downloadImage(url: string, signal: AbortSignal) {
  const target = toHttpUrl(url);

  if (!target) {
    return null;
  }

  const { bytes } = await fetchPublicResource(target, {
    accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
    maxBytes: MAX_IMAGE_BYTES,
    signal,
  });
  const format = detectImageFormat(bytes);

  if (!format || isTinyImage(format, bytes)) {
    return null;
  }

  return { bytes, format };
}

async function readStoredLogo(fileName: string): Promise<StoredLogo | null> {
  const parsed = parseLogoFileName(fileName);

  if (!parsed) {
    return null;
  }

  try {
    const bytes = await readFile(path.join(getLogoDirectory(), fileName));
    return { bytes, contentType: IMAGE_FORMATS[parsed.format], version: parsed.version };
  } catch {
    return null;
  }
}

function parseLogoFileName(fileName: string) {
  const match = LOGO_FILE_PATTERN.exec(fileName);

  if (!match) {
    return null;
  }

  return {
    version: match[2],
    fit: (match[3] ? "cover" : "contain") as CompanyLogoFit,
    format: match[4] as ImageFormat,
  };
}

function getLogoDirectory() {
  return path.join(getUploadsRoot(), LOGO_DIRECTORY);
}

function resolveDocumentBase(href: string | undefined, pageUrl: URL) {
  return toHttpUrl(href, pageUrl) ?? pageUrl;
}

function toHttpUrl(value: string | undefined, base?: URL) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** `sizes="32x32 192x192"` → 192. `any` (SVG) and junk → null. */
function largestDeclaredSize(sizes: string | undefined) {
  const values = (sizes ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((size) => Number(size.split("x")[0]))
    .filter((size) => Number.isFinite(size) && size > 0);

  return values.length > 0 ? Math.max(...values) : null;
}

function detectImageFormat(bytes: Buffer): ImageFormat | null {
  if (bytes.length < 12) {
    return null;
  }

  const head = bytes.subarray(0, 12).toString("latin1");

  if (head.startsWith("\x89PNG\r\n\x1a\n")) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return "gif";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "webp";
  if (head.slice(4, 12) === "ftypavif" || head.slice(4, 12) === "ftypavis") return "avif";
  if (bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1 && bytes.readUInt16LE(4) > 0) {
    return "ico";
  }

  const text = bytes.subarray(0, 4096).toString("utf8").replace(/^﻿/, "").trimStart();

  if (text.startsWith("<") && /<svg[\s>]/i.test(text) && !/<(html|head|body)[\s>]/i.test(text)) {
    return "svg";
  }

  return null;
}

function isTinyImage(format: ImageFormat, bytes: Buffer) {
  let size: number | null = null;

  if (format === "png" && bytes.length >= 24) {
    size = Math.max(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  } else if (format === "gif") {
    size = Math.max(bytes.readUInt16LE(6), bytes.readUInt16LE(8));
  } else if (format === "ico") {
    const count = bytes.readUInt16LE(4);
    size = 0;

    for (let index = 0; index < count && 6 + index * 16 + 1 < bytes.length; index += 1) {
      // 0 means 256 in the ICO directory.
      const width = bytes[6 + index * 16] || 256;
      size = Math.max(size, width);
    }
  }

  return size !== null && size < MIN_ICON_SIZE;
}

/** A definitive answer from the site; `transient` marks one worth retrying soon. */
class LogoFetchError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "LogoFetchError";
  }
}

// fetch's own network and timeout errors, and DNS failures, count as transient.
function isTransientError(error: unknown) {
  return !(error instanceof LogoFetchError) || error.transient;
}

// Icon URLs come from third-party HTML: never let them reach this machine,
// the LAN, the tailnet or cloud metadata endpoints.
const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}

// No `::ffff:0:0/96` rule: BlockList already checks IPv4-mapped addresses
// against the IPv4 rules, and that rule would match every IPv4 address.
for (const [network, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

function isBlockedAddress(address: string) {
  return blockedAddresses.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LogoFetchError(`Unsupported protocol: ${url.protocol}`, false);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

  // Checked before connecting; fetch resolves the name again, so a DNS answer
  // that changes in between isn't covered. Fine for a single-user tool.
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new LogoFetchError(`Blocked host: ${hostname}`, false);
  }
}

async function fetchPublicResource(
  target: URL,
  options: { accept: string; maxBytes: number; signal: AbortSignal },
) {
  let url = target;

  // Redirects are followed by hand so every hop goes through assertPublicUrl.
  for (let redirects = 0; ; redirects += 1) {
    await assertPublicUrl(url);

    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      headers: {
        "user-agent": USER_AGENT,
        accept: options.accept,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    const location = response.headers.get("location");

    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();

      if (redirects >= MAX_REDIRECTS) {
        throw new LogoFetchError("Too many redirects", false);
      }

      url = new URL(location, url);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new LogoFetchError(
        `HTTP ${response.status}`,
        response.status === 408 || response.status === 429 || response.status >= 500,
      );
    }

    return { url, bytes: await readLimitedBody(response, options.maxBytes) };
  }
}

async function readLimitedBody(response: Response, maxBytes: number) {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new LogoFetchError("Response too large", false);
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.byteLength;

    if (size > maxBytes) {
      await reader.cancel();
      throw new LogoFetchError("Response too large", false);
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
}
