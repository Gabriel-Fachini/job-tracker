import * as cheerio from "cheerio";
import type { Browser, Page } from "playwright";

import type { DiscoveredLink, FetchLike, MonitoringCompany } from "./types";

const JOB_PATH_PATTERN =
  /(job|jobs|career|careers|vaga|vagas|opening|openings|position|positions|opportunit)/i;
const BLOCKED_PATH_PATTERN =
  /(login|signin|sign-in|terms|privacy|policy|cookies|mailto:|tel:|javascript:)/i;
const GENERIC_BOARD_PATH_PATTERN =
  /^\/(job|jobs|career|careers|vaga|vagas|opening|openings|position|positions)\/?$/i;
const GENERIC_LINK_TEXT_PATTERN =
  /^(jobs?|careers?|vagas?|openings?|positions?|ver vagas|veja todas as vagas|todas as vagas|see jobs|see all jobs|learn more|saiba mais)$/i;
const PAGINATION_PATTERN = /(?:^|[?&])(page|pagina|pg|p)=\d+/i;
const MAX_DISCOVERED_LINKS = 500;
const MAX_PAGINATION_PAGES = 20;

const COOKIE_BUTTON_PATTERN =
  /\b(accept|agree|allow|ok|entendi|aceitar|aceito|concordo|continuar)\b/i;
const ITEMS_PER_PAGE_PATTERN =
  /\b(items per page|results per page|por pagina|por página|itens por pagina|itens por página)\b/i;
const NEXT_BUTTON_PATTERN =
  /(next|nextbutton|proxima|próxima|avancar|avançar|continuar|pagination-next)/i;

type DiscoveryOptions = {
  browserSessionFactory?: BrowserSessionFactory;
  fetchImpl?: FetchLike;
};

type BrowserDiscoverySnapshot = {
  activePaginationLabel: string | null;
  hasNextPage: boolean;
  links: DiscoveredLink[];
};

type BrowserSession = {
  captureSnapshot: () => Promise<BrowserDiscoverySnapshot>;
  close: () => Promise<void>;
  dismissCookieBanner: () => Promise<void>;
  expandItemsPerPage: () => Promise<void>;
  goToNextPage: () => Promise<boolean>;
};

type BrowserSessionFactory = (
  url: string,
) => Promise<BrowserSession>;

type PageContent = {
  html: string;
  url: string;
};

export async function discoverJobLinks(
  company: MonitoringCompany,
  options: DiscoveryOptions = {},
): Promise<DiscoveredLink[]> {
  switch (company.jobBoardNavigationMode) {
    case "browser":
      return discoverJobLinksWithBrowser(company, options);
    case "fetch":
    default:
      return discoverJobLinksWithFetch(company, options);
  }
}

export async function discoverJobLinksWithFetch(
  company: MonitoringCompany,
  options: DiscoveryOptions = {},
): Promise<DiscoveredLink[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const discovered = new Map<string, DiscoveredLink>();
  const visitedPages = new Set<string>();
  const queue = [company.jobsBoardUrl];

  logDiscoveryStep(company.name, "fetch-discovery-start", {
    url: company.jobsBoardUrl,
  });

  while (queue.length > 0 && visitedPages.size < MAX_PAGINATION_PAGES) {
    const nextPageUrl = queue.shift();

    if (!nextPageUrl) {
      continue;
    }

    const normalizedPageUrl = normalizeComparableUrl(new URL(nextPageUrl));

    if (visitedPages.has(normalizedPageUrl)) {
      continue;
    }

    visitedPages.add(normalizedPageUrl);
    const page = await fetchDiscoveryPage(nextPageUrl, fetchImpl);
    logDiscoveryStep(company.name, "fetch-page", {
      page: page.url || nextPageUrl,
      pageIndex: visitedPages.size,
      queueSize: queue.length,
    });
    const pageLinks = discoverJobLinksFromHtml(page.url, page.html);
    mergeDiscoveredLinks(discovered, pageLinks);
    logDiscoveryStep(company.name, "fetch-page-result", {
      page: page.url,
      linksFoundOnPage: pageLinks.length,
      linksAccumulated: discovered.size,
    });

    if (discovered.size >= MAX_DISCOVERED_LINKS) {
      break;
    }

    const paginationUrls = extractPaginationUrls(page.url, page.html);

    for (const paginationUrl of paginationUrls) {
      const normalizedPaginationUrl = normalizeComparableUrl(
        new URL(paginationUrl),
      );

      if (!visitedPages.has(normalizedPaginationUrl)) {
        queue.push(paginationUrl);
      }
    }

    if (paginationUrls.length > 0) {
      logDiscoveryStep(company.name, "fetch-pagination-links", {
        page: page.url,
        paginationUrls,
      });
    }
  }

  logDiscoveryStep(company.name, "fetch-discovery-finished", {
    pagesVisited: visitedPages.size,
    linksFound: discovered.size,
  });

  return [...discovered.values()].slice(0, MAX_DISCOVERED_LINKS);
}

export async function discoverJobLinksWithBrowser(
  company: MonitoringCompany,
  options: DiscoveryOptions = {},
): Promise<DiscoveredLink[]> {
  const createBrowserSession =
    options.browserSessionFactory ?? createPlaywrightBrowserSession;
  const session = await createBrowserSession(company.jobsBoardUrl);
  const discovered = new Map<string, DiscoveredLink>();
  const visitedFingerprints = new Set<string>();

  try {
    logDiscoveryStep(company.name, "browser-discovery-start", {
      url: company.jobsBoardUrl,
    });
    await session.dismissCookieBanner();
    await session.expandItemsPerPage();

    for (let pageIndex = 0; pageIndex < MAX_PAGINATION_PAGES; pageIndex += 1) {
      const snapshot = await session.captureSnapshot();
      mergeDiscoveredLinks(discovered, snapshot.links);
      logDiscoveryStep(company.name, "browser-page-result", {
        pageIndex: pageIndex + 1,
        activePaginationLabel: snapshot.activePaginationLabel,
        hasNextPage: snapshot.hasNextPage,
        linksVisibleOnPage: snapshot.links.length,
        linksAccumulated: discovered.size,
      });

      const fingerprint = buildBrowserSnapshotFingerprint(snapshot);

      if (visitedFingerprints.has(fingerprint)) {
        logDiscoveryStep(company.name, "browser-stop-repeated-page", {
          pageIndex: pageIndex + 1,
          activePaginationLabel: snapshot.activePaginationLabel,
        });
        break;
      }

      visitedFingerprints.add(fingerprint);

      if (
        discovered.size >= MAX_DISCOVERED_LINKS ||
        !snapshot.hasNextPage
      ) {
        logDiscoveryStep(company.name, "browser-stop-limit-or-end", {
          pageIndex: pageIndex + 1,
          hasNextPage: snapshot.hasNextPage,
          linksAccumulated: discovered.size,
        });
        break;
      }

      const advanced = await session.goToNextPage();

      if (!advanced) {
        logDiscoveryStep(company.name, "browser-next-page-failed", {
          pageIndex: pageIndex + 1,
        });
        break;
      }

      logDiscoveryStep(company.name, "browser-advanced-page", {
        fromPageIndex: pageIndex + 1,
      });
    }
  } finally {
    await session.close();
  }

  logDiscoveryStep(company.name, "browser-discovery-finished", {
    linksFound: discovered.size,
  });

  return [...discovered.values()].slice(0, MAX_DISCOVERED_LINKS);
}

export function discoverJobLinksFromHtml(
  baseUrl: string,
  html: string,
): DiscoveredLink[] {
  const discovered = new Map<string, DiscoveredLink>();
  mergeDiscoveredLinks(discovered, extractAnchorLinks(baseUrl, html));

  const links = [...discovered.values()].slice(0, MAX_DISCOVERED_LINKS);

  if (links.length > 0) {
    return links;
  }

  if (pageLooksLikeSingleJobPosting(html)) {
    return [{ url: baseUrl, text: null }];
  }

  return [];
}

export function isLikelyJobUrl(
  baseUrl: string,
  candidateUrl: string,
  linkText: string | null = null,
) {
  const base = new URL(baseUrl);
  const candidate = new URL(candidateUrl);
  const pathAndQuery = `${candidate.pathname}${candidate.search}`;
  const normalizedLinkText = normalizeWhitespace(linkText ?? "").toLowerCase();
  const normalizedBaseUrl = normalizeComparableUrl(base);
  const normalizedCandidateUrl = normalizeComparableUrl(candidate);
  const hasJobKeyword =
    JOB_PATH_PATTERN.test(candidateUrl) || JOB_PATH_PATTERN.test(pathAndQuery);
  const hasDetailSignal =
    hasJobDetailPath(candidate.pathname) ||
    hasJobDetailQuery(candidate.search) ||
    hasSpecificJobText(normalizedLinkText);

  if (BLOCKED_PATH_PATTERN.test(candidateUrl)) {
    return false;
  }

  if (normalizedCandidateUrl === normalizedBaseUrl) {
    return false;
  }

  if (candidate.hash) {
    return false;
  }

  if (candidate.hostname.includes("linkedin.com")) {
    return false;
  }

  if (!hasJobKeyword) {
    return false;
  }

  if (GENERIC_BOARD_PATH_PATTERN.test(candidate.pathname) && !hasDetailSignal) {
    return false;
  }

  if (candidate.origin !== base.origin && !hasDetailSignal) {
    return false;
  }

  return hasDetailSignal || candidate.origin === base.origin;
}

export function pageLooksLikeSingleJobPosting(html: string) {
  const lowered = html.toLowerCase();

  return (
    lowered.includes('"@type":"jobposting"') ||
    lowered.includes('"@type": "jobposting"') ||
    lowered.includes("application/ld+json")
  );
}

export function buildBrowserSnapshotFingerprint(
  snapshot: BrowserDiscoverySnapshot,
) {
  return JSON.stringify({
    activePaginationLabel: snapshot.activePaginationLabel ?? null,
    urls: snapshot.links
      .map((link) => link.url)
      .sort((left, right) => left.localeCompare(right)),
  });
}

function extractAnchorLinks(baseUrl: string, html: string) {
  const $ = cheerio.load(html);
  const discovered = new Map<string, DiscoveredLink>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const resolved = safeResolveUrl(baseUrl, href);
    const text = normalizeWhitespace($(element).text()) || null;

    if (!resolved || !isLikelyJobUrl(baseUrl, resolved, text)) {
      return;
    }

    if (!discovered.has(resolved)) {
      discovered.set(resolved, { url: resolved, text });
    }
  });

  return [...discovered.values()];
}

function extractPaginationUrls(baseUrl: string, html: string) {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $("a[href], link[rel='next']").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const resolved = safeResolveUrl(baseUrl, href);

    if (!resolved) {
      return;
    }

    const url = new URL(resolved);
    const combined = `${url.pathname}${url.search}`;

    if (
      PAGINATION_PATTERN.test(url.search) ||
      /\/page\/\d+/i.test(url.pathname) ||
      ($(element).attr("rel") ?? "").toLowerCase() === "next" ||
      /next|proxima|próxima/i.test(
        `${normalizeWhitespace($(element).text())} ${combined}`,
      )
    ) {
      urls.add(resolved);
    }
  });

  return [...urls];
}

async function createPlaywrightBrowserSession(
  url: string,
): Promise<BrowserSession> {
  const playwright = await import("playwright");
  const browser = await launchBrowser(playwright.chromium);
  const context = await browser.newContext({
    locale: "pt-BR",
    userAgent:
      "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
  });
  const page = await context.newPage();

  await page.goto(url, {
    timeout: 45_000,
    waitUntil: "domcontentloaded",
  });
  await waitForPageSettling(page);

  return {
    dismissCookieBanner: async () => {
      await dismissCookieBanner(page);
    },
    expandItemsPerPage: async () => {
      await expandItemsPerPage(page);
    },
    captureSnapshot: async () => captureBrowserSnapshot(page, url),
    goToNextPage: async () => goToNextPage(page),
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

async function launchBrowser(
  chromium: typeof import("playwright").chromium,
): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({
      channel: "chrome",
      headless: true,
    });
  }
}

async function captureBrowserSnapshot(
  page: Page,
  baseUrl: string,
): Promise<BrowserDiscoverySnapshot> {
  await waitForPageSettling(page);

  const links = await readVisibleBrowserLinks(page, baseUrl);

  const filteredLinks = dedupeLinks(
    links.filter((link) => isLikelyJobUrl(baseUrl, link.url, link.text)),
  ).slice(0, MAX_DISCOVERED_LINKS);

  const paginationState = await readPaginationState(page);

  return {
    links: filteredLinks,
    activePaginationLabel: paginationState.activeLabel,
    hasNextPage: paginationState.hasNext,
  };
}

async function readPaginationState(page: Page) {
  return page.evaluate(
    ({ nextPatternSource }) => {
      const nextPattern = new RegExp(nextPatternSource, "i");
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          "nav, [aria-label*='pagination' i], [class*='pagination' i], [role='navigation']",
        ),
      );

      const containers =
        candidates.length > 0 ? candidates : [document.body as HTMLElement];

      let activeLabel: string | null = null;
      let hasNext = false;

      for (const container of containers) {
        const activeElement = container.querySelector<HTMLElement>(
          "[aria-current='page'], [aria-selected='true'], [data-active='true'], .active, .selected",
        );

        if (!activeLabel && activeElement) {
          activeLabel = activeElement.textContent?.replace(/\s+/g, " ").trim() ?? null;
        }

        const nextElement = Array.from(
          container.querySelectorAll<HTMLElement>("button, a, [role='button']"),
        ).find((element) => {
          const label = [
            element.getAttribute("aria-label") ?? "",
            element.textContent ?? "",
            element.getAttribute("title") ?? "",
          ]
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          return nextPattern.test(label);
        });

        if (!nextElement) {
          continue;
        }

        const disabled =
          nextElement.hasAttribute("disabled") ||
          nextElement.getAttribute("aria-disabled") === "true" ||
          nextElement.classList.contains("disabled");

        if (!disabled) {
          hasNext = true;
        }

        break;
      }

      return { activeLabel, hasNext };
    },
    { nextPatternSource: NEXT_BUTTON_PATTERN.source },
  );
}

async function dismissCookieBanner(page: Page) {
  const buttons = page.locator("button, [role='button'], a");
  const count = await buttons.count();

  for (let index = 0; index < Math.min(count, 12); index += 1) {
    const candidate = buttons.nth(index);
    const text = normalizeWhitespace(
      [await candidate.getAttribute("aria-label"), await candidate.textContent()]
        .filter(Boolean)
        .join(" "),
    );

    if (!COOKIE_BUTTON_PATTERN.test(text)) {
      continue;
    }

    try {
      await candidate.click({ timeout: 1_500 });
      await page.waitForTimeout(500);
      return;
    } catch {
      continue;
    }
  }
}

async function expandItemsPerPage(page: Page) {
  const selects = page.locator("select");
  const count = await selects.count();

  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    const nearbyText = normalizeWhitespace(
      [
        await select.getAttribute("aria-label"),
        await select.evaluate((node) => {
          const label = node.closest("label");
          return label?.textContent ?? node.parentElement?.textContent ?? "";
        }),
      ]
        .filter(Boolean)
        .join(" "),
    );

    if (!ITEMS_PER_PAGE_PATTERN.test(nearbyText)) {
      continue;
    }

    try {
      const options = await select.locator("option").evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
            value: (node as HTMLOptionElement).value,
          }))
          .map((option) => ({
            ...option,
            numericValue: Number.parseInt(option.value || option.text, 10),
          }))
          .filter((option) => Number.isFinite(option.numericValue)),
      );

      const bestOption = options.sort(
        (left, right) => right.numericValue - left.numericValue,
      )[0];

      if (!bestOption) {
        continue;
      }

      await select.selectOption(bestOption.value);
      await waitForPageSettling(page);
      return;
    } catch {
      continue;
    }
  }
}

async function goToNextPage(page: Page) {
  const previousFingerprint = await readVisibleBrowserLinkFingerprint(page);
  const candidates = page.locator("nav button, nav a, [aria-label*='pagination' i] button, [aria-label*='pagination' i] a, [class*='pagination' i] button, [class*='pagination' i] a, button, a");
  const count = await candidates.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const text = normalizeWhitespace(
      [
        await candidate.getAttribute("aria-label"),
        await candidate.getAttribute("title"),
        await candidate.textContent(),
      ]
        .filter(Boolean)
        .join(" "),
    );

    if (!NEXT_BUTTON_PATTERN.test(text)) {
      continue;
    }

    const isDisabled = await candidate.evaluate((node) => {
      const element = node as HTMLElement;
      return (
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true" ||
        element.classList.contains("disabled")
      );
    });

    if (isDisabled) {
      return false;
    }

    try {
      await candidate.scrollIntoViewIfNeeded();
      await candidate.click({ timeout: 3_000 });
      await waitForPageSettling(page);
      await waitForVisibleLinksToChange(page, previousFingerprint);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function waitForPageSettling(page: Page) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 5_000 });
  } catch {
    await page.waitForTimeout(1_200);
  }
}

async function readVisibleBrowserLinks(page: Page, baseUrl: string) {
  return page.evaluate(
    ({ url }) => {
      return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .filter((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();

          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0 &&
            !!node.offsetParent
          );
        })
        .map((node) => ({
          href: node.getAttribute("href"),
          text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
        }))
        .filter((node) => Boolean(node.href))
        .map((node) => ({
          url: new URL(node.href as string, url).toString(),
          text: node.text || null,
        }));
    },
    { url: baseUrl },
  );
}

async function readVisibleBrowserLinkFingerprint(page: Page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          !!node.offsetParent
        );
      })
      .map((node) => node.href)
      .sort((left, right) => left.localeCompare(right))
      .join("|");
  });
}

async function waitForVisibleLinksToChange(page: Page, previousFingerprint: string) {
  try {
    await page.waitForFunction(
      ({ before }) => {
        const currentFingerprint = Array.from(
          document.querySelectorAll<HTMLAnchorElement>("a[href]"),
        )
          .filter((node) => {
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();

            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0 &&
              !!node.offsetParent
            );
          })
          .map((node) => node.href)
          .sort((left, right) => left.localeCompare(right))
          .join("|");

        return currentFingerprint !== before;
      },
      { before: previousFingerprint },
      { timeout: 12_000 },
    );
  } catch {
    await page.waitForTimeout(8_000);
  }
}

async function fetchDiscoveryPage(url: string, fetchImpl: FetchLike) {
  const response = await fetchImpl(url, {
    headers: createRequestHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Nao foi possivel acessar o job board com status ${response.status}.`,
    );
  }

  return {
    html: await response.text(),
    url: response.url || url,
  } satisfies PageContent;
}

function mergeDiscoveredLinks(
  target: Map<string, DiscoveredLink>,
  links: DiscoveredLink[],
) {
  for (const link of links) {
    if (!target.has(link.url)) {
      target.set(link.url, link);
    }

    if (target.size >= MAX_DISCOVERED_LINKS) {
      break;
    }
  }
}

function dedupeLinks(links: DiscoveredLink[]) {
  const unique = new Map<string, DiscoveredLink>();

  for (const link of links) {
    if (!unique.has(link.url)) {
      unique.set(link.url, link);
    }
  }

  return [...unique.values()];
}

function safeResolveUrl(baseUrl: string, href: string) {
  if (!href || BLOCKED_PATH_PATTERN.test(href)) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeComparableUrl(url: URL) {
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return `${url.origin}${pathname}${url.search}`;
}

function hasJobDetailPath(pathname: string) {
  return /\/(jobs?|careers?|vagas?|openings?|positions?)\/[^/?#]+/i.test(
    pathname,
  );
}

function hasJobDetailQuery(search: string) {
  return /(?:^|[?&])(gh_jid|job(id)?|opening(id)?|vacancy(id)?)=/i.test(search);
}

function hasSpecificJobText(text: string) {
  if (!text || GENERIC_LINK_TEXT_PATTERN.test(text)) {
    return false;
  }

  return text.split(/\s+/).filter(Boolean).length >= 2;
}

function createRequestHeaders() {
  return {
    "user-agent":
      "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function logDiscoveryStep(
  companyName: string,
  step: string,
  payload: Record<string, unknown>,
) {
  console.log(`[job-monitoring] [${companyName}] ${step}`, payload);
}
