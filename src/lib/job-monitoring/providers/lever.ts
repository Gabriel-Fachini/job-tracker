import type { DiscoveredLink } from "../types";

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
  accept: "application/json",
};

type LeverList = { text?: string; content?: string };

export type LeverPosting = {
  id: string;
  text: string;
  description?: string;
  descriptionPlain?: string;
  lists?: LeverList[];
  additional?: string;
  additionalPlain?: string;
  categories?: {
    location?: string | null;
    allLocations?: string[] | null;
    commitment?: string | null;
  };
  workplaceType?: string | null;
  salaryRange?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    interval?: string | null;
  } | null;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
};

export type LeverBoard = { org: string; apiBase: string };

/** `jobs.lever.co/<org>` (US) and `jobs.eu.lever.co/<org>` (EU) -> API base + org. */
export function parseLeverBoardUrl(boardUrl: string): LeverBoard | null {
  try {
    const url = new URL(boardUrl);
    const host = url.hostname.toLowerCase();
    const org = url.pathname.split("/").filter(Boolean)[0];

    if (!org) {
      return null;
    }

    if (host === "jobs.lever.co") {
      return { org, apiBase: "https://api.lever.co" };
    }

    if (host === "jobs.eu.lever.co") {
      return { org, apiBase: "https://api.eu.lever.co" };
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchLeverJobs(
  boardUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscoveredLink[]> {
  const board = parseLeverBoardUrl(boardUrl);

  if (!board) {
    return [];
  }

  const response = await fetchImpl(
    `${board.apiBase}/v0/postings/${encodeURIComponent(board.org)}?mode=json`,
    { headers: HEADERS, cache: "no-store" },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Lever board inválido ou inacessível: ${board.org}`);
    }

    throw new Error(`Erro ao acessar Lever API: ${response.status}`);
  }

  const data = (await response.json()) as LeverPosting[];

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((posting) => posting.text && posting.hostedUrl).map(mapLeverPosting);
}

export function mapLeverPosting(posting: LeverPosting): DiscoveredLink {
  const applyUrl =
    posting.applyUrl && posting.applyUrl !== posting.hostedUrl ? posting.applyUrl : undefined;

  return {
    url: posting.hostedUrl,
    text: posting.text,
    prefetched: {
      title: posting.text,
      descriptionHtml: buildLeverDescriptionHtml(posting),
      locationText: formatLeverLocation(posting),
      updatedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : undefined,
      externalId: posting.id,
      salaryText: formatLeverSalary(posting.salaryRange) ?? undefined,
      workModel: mapLeverWorkModel(posting.workplaceType),
      applyUrl,
    },
  };
}

function buildLeverDescriptionHtml(posting: LeverPosting): string {
  const parts: string[] = [];

  if (posting.description) {
    parts.push(posting.description);
  } else if (posting.descriptionPlain) {
    parts.push(`<p>${escapeHtml(posting.descriptionPlain).replace(/\n{2,}/g, "</p><p>")}</p>`);
  }

  for (const list of posting.lists ?? []) {
    if (!list.content) continue;

    if (list.text) {
      parts.push(`<h3>${escapeHtml(list.text)}</h3>`);
    }

    parts.push(`<ul>${list.content}</ul>`);
  }

  if (posting.additional) {
    parts.push(posting.additional);
  } else if (posting.additionalPlain) {
    parts.push(`<p>${escapeHtml(posting.additionalPlain)}</p>`);
  }

  return parts.join("\n");
}

function formatLeverLocation(posting: LeverPosting): string | undefined {
  const all = posting.categories?.allLocations?.filter(Boolean) ?? [];
  const primary = posting.categories?.location?.trim();
  const parts = [...new Set([...(primary ? [primary] : []), ...all])];

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function mapLeverWorkModel(
  workplaceType: string | null | undefined,
): "remote" | "hybrid" | "onsite" | undefined {
  const normalized = workplaceType?.toLowerCase().replace(/[^a-z]/g, "");

  if (normalized === "remote") return "remote";
  if (normalized === "hybrid") return "hybrid";
  if (normalized === "onsite") return "onsite";

  return undefined;
}

function formatLeverSalary(range: LeverPosting["salaryRange"]): string | null {
  if (!range || (range.min == null && range.max == null)) {
    return null;
  }

  const format = (value: number) => new Intl.NumberFormat("en-US").format(value);
  const amount =
    range.min != null && range.max != null && range.min !== range.max
      ? `${format(range.min)}-${format(range.max)}`
      : format((range.min ?? range.max) as number);
  const currency = range.currency ? `${range.currency} ` : "";
  const interval = humanizeLeverInterval(range.interval);

  return `${currency}${amount}${interval ? ` / ${interval}` : ""}`;
}

function humanizeLeverInterval(interval: string | null | undefined) {
  const normalized = interval?.toLowerCase() ?? "";

  if (normalized.includes("year")) return "year";
  if (normalized.includes("month")) return "month";
  if (normalized.includes("week")) return "week";
  if (normalized.includes("hour")) return "hour";

  return null;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
