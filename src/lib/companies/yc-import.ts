import pLimit from "p-limit";

import { CompanyIndex, type IndexedCompany } from "./company-index";
import { discoverAts, type AtsDiscovery } from "./ats-discovery";
import { normalizeWebsiteOrigin } from "./normalize";

export const YC_COMPANIES_URL = "https://yc-oss.github.io/api/companies/all.json";
const DISCOVERY_CONCURRENCY = 5;

/** The subset of the yc-oss dataset the import reads. */
export type YcCompany = {
  name: string;
  slug?: string;
  website?: string | null;
  isHiring?: boolean;
  status?: string;
  regions?: string[] | null;
  all_locations?: string | null;
  one_liner?: string | null;
  url?: string | null;
};

/** Hiring, active and remote (regions include "Remote" or a location says so). */
export function filterYcCompanies(all: YcCompany[]): YcCompany[] {
  return all.filter(
    (company) =>
      Boolean(company.name) &&
      company.isHiring === true &&
      company.status === "Active" &&
      (Boolean(company.regions?.includes("Remote")) ||
        /remote/i.test(company.all_locations ?? "")),
  );
}

export async function fetchYcCompanies(fetchImpl: typeof fetch = fetch): Promise<YcCompany[]> {
  const response = await fetchImpl(YC_COMPANIES_URL, {
    headers: { accept: "application/json", "user-agent": "JobTrackerRadar/1.0 (personal job search)" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar a lista da YC: HTTP ${response.status}`);
  }

  const data = (await response.json()) as unknown;

  if (!Array.isArray(data)) {
    throw new Error("Formato inesperado na lista da YC.");
  }

  return data as YcCompany[];
}

export type YcImportRow = {
  name: string;
  website: string | null;
  ycUrl: string | null;
  action: "created" | "updated" | "unchanged";
  companyId: number | null;
  ats: AtsDiscovery | null;
};

export type YcImportSummary = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  withAts: number;
  withoutAts: number;
  byProvider: Record<string, number>;
};

/** Persistence for the import; the CLI uses the database, tests use fakes. */
export type YcImportStore = {
  existingCompanies(): Array<IndexedCompany & { origin: string; jobsBoardUrl: string | null }>;
  createCompany(input: {
    name: string;
    website: string | null;
    jobsBoardUrl: string | null;
    atsProvider: string;
    radarEnabled: boolean;
  }): number;
  /** Fills the board of an existing company that has none. */
  applyDiscovery(companyId: number, ats: AtsDiscovery): void;
};

export type YcImportOptions = {
  companies: YcCompany[];
  store?: YcImportStore;
  /** Discovery is skipped for companies that already have a board. Dry runs never write. */
  dryRun?: boolean;
  discover?: typeof discoverAts;
  concurrency?: number;
  onProgress?: (row: YcImportRow, done: number, total: number) => void;
  signal?: AbortSignal;
};

/**
 * Imports the YC companies: upsert by domain/name (`origin = yc_import` for new
 * ones), then ATS discovery. A found ATS sets the board and turns the radar on;
 * otherwise the radar stays off. Idempotent: existing companies with a board are
 * left alone; existing ones without a board get the discovery result.
 */
export async function importYcCompanies(options: YcImportOptions) {
  const dryRun = options.dryRun ?? false;
  const discover = options.discover ?? discoverAts;
  const store = options.store;

  if (!dryRun && !store) {
    throw new Error("importYcCompanies precisa de um store para gravar (ou use dryRun).");
  }

  const existing = store?.existingCompanies() ?? [];
  const index = new CompanyIndex(existing);
  const existingById = new Map(existing.map((company) => [company.id, company]));
  const limit = pLimit(options.concurrency ?? DISCOVERY_CONCURRENCY);
  const rows: YcImportRow[] = [];
  const seenNames = new Set<string>();
  const targets = options.companies.filter((company) => {
    const key = company.name.trim().toLowerCase();

    if (seenNames.has(key)) {
      return false;
    }

    seenNames.add(key);
    return true;
  });

  let done = 0;

  await Promise.all(
    targets.map((company) =>
      limit(async () => {
        if (options.signal?.aborted) {
          return;
        }

        const website = normalizeWebsiteOrigin(company.website);
        const knownId = index.find({ name: company.name, website });
        const known = knownId !== null ? existingById.get(knownId) : undefined;
        // A company that already has a board keeps it: no discovery, no writes.
        const needsDiscovery = !known || !known.jobsBoardUrl;
        const ats = needsDiscovery
          ? await discover({ name: company.name, website }, { signal: options.signal }).catch(() => null)
          : null;

        let action: YcImportRow["action"] = "unchanged";
        let companyId: number | null = known?.id ?? null;

        if (!dryRun && store) {
          if (!known) {
            companyId = store.createCompany({
              name: company.name.trim(),
              website,
              jobsBoardUrl: ats?.boardUrl ?? null,
              atsProvider: ats?.provider ?? "auto",
              radarEnabled: Boolean(ats),
            });
            index.add({ id: companyId, name: company.name, website });
            action = "created";
          } else if (ats) {
            store.applyDiscovery(known.id, ats);
            action = "updated";
          }
        } else {
          action = known ? (ats ? "updated" : "unchanged") : "created";
        }

        const row: YcImportRow = {
          name: company.name.trim(),
          website,
          ycUrl: company.url ?? null,
          action,
          companyId,
          ats,
        };

        rows.push(row);
        done += 1;
        options.onProgress?.(row, done, targets.length);
      }),
    ),
  );

  const byProvider: Record<string, number> = {};

  for (const row of rows) {
    if (row.ats) {
      byProvider[row.ats.provider] = (byProvider[row.ats.provider] ?? 0) + 1;
    }
  }

  const summary: YcImportSummary = {
    total: rows.length,
    created: rows.filter((row) => row.action === "created").length,
    updated: rows.filter((row) => row.action === "updated").length,
    unchanged: rows.filter((row) => row.action === "unchanged").length,
    withAts: rows.filter((row) => row.ats).length,
    withoutAts: rows.filter((row) => !row.ats).length,
    byProvider,
  };

  return { rows, summary };
}
