import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, glassdoorSnapshots } from "@/lib/db/schema";

import { normalizeCompanyName, parseGlassdoorId } from "./identity";

type DatabaseLike = Pick<typeof db, "select">;

type CompanyRow = typeof companies.$inferSelect;

/**
 * Finds the registered company a Glassdoor employer belongs to.
 *
 * 1. Glassdoor id: parsed from `companies.glassdoor_url`, or stored on one of
 *    the company's earlier snapshots.
 * 2. Normalized name (lowercase, no accents), but never a company already tied
 *    to a different Glassdoor id: same name, different employer.
 */
export function findCompanyForGlassdoor(
  database: DatabaseLike,
  { glassdoorId, name }: { glassdoorId?: number | null; name?: string | null },
): CompanyRow | null {
  const rows = database.select().from(companies).all();

  if (glassdoorId) {
    const byUrl = rows.find((row) => parseGlassdoorId(row.glassdoorUrl) === glassdoorId);

    if (byUrl) {
      return byUrl;
    }

    const snapshot = database
      .select({ companyId: glassdoorSnapshots.companyId })
      .from(glassdoorSnapshots)
      .where(eq(glassdoorSnapshots.glassdoorId, glassdoorId))
      .get();
    const bySnapshot = snapshot && rows.find((row) => row.id === snapshot.companyId);

    if (bySnapshot) {
      return bySnapshot;
    }
  }

  const normalized = name ? normalizeCompanyName(name) : "";

  if (!normalized) {
    return null;
  }

  const candidates = rows.filter((row) => normalizeCompanyName(row.name) === normalized);

  return (
    candidates.find((row) => {
      const knownId = knownGlassdoorId(database, row);
      return knownId === null || !glassdoorId || knownId === glassdoorId;
    }) ?? null
  );
}

/** The Glassdoor id tied to a company: from its URL, else from its latest snapshot. */
export function knownGlassdoorId(
  database: DatabaseLike,
  company: Pick<CompanyRow, "id" | "glassdoorUrl">,
): number | null {
  const fromUrl = parseGlassdoorId(company.glassdoorUrl);

  if (fromUrl) {
    return fromUrl;
  }

  return (
    database
      .select({ glassdoorId: glassdoorSnapshots.glassdoorId })
      .from(glassdoorSnapshots)
      .where(eq(glassdoorSnapshots.companyId, company.id))
      .orderBy(desc(glassdoorSnapshots.collectedAt))
      .limit(1)
      .get()?.glassdoorId ?? null
  );
}
