import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

import type { AtsDiscovery } from "./ats-discovery";
import type { YcImportStore } from "./yc-import";

/** Sets the board found by ATS discovery and turns the radar on for the company. */
export function applyDiscoveredAts(companyId: number, ats: AtsDiscovery): boolean {
  const { changes } = db
    .update(companies)
    .set({
      jobsBoardUrl: ats.boardUrl,
      atsProvider: ats.provider,
      jobBoardNavigationMode: "fetch",
      radarEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .run();

  return changes > 0;
}

/** Database-backed store for the YC import. */
export function createYcImportStore(): YcImportStore {
  return {
    existingCompanies() {
      return db
        .select({
          id: companies.id,
          name: companies.name,
          website: companies.website,
          origin: companies.origin,
          jobsBoardUrl: companies.jobsBoardUrl,
        })
        .from(companies)
        .all();
    },
    createCompany(input) {
      const now = new Date();

      return db
        .insert(companies)
        .values({
          name: input.name,
          website: input.website,
          jobsBoardUrl: input.jobsBoardUrl,
          atsProvider: input.atsProvider,
          status: "monitoring",
          origin: "yc_import",
          radarEnabled: input.radarEnabled,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: companies.id })
        .get().id;
    },
    applyDiscovery(companyId, ats) {
      applyDiscoveredAts(companyId, ats);
    },
  };
}
