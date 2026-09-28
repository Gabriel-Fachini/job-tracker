import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

import { CompanyIndex } from "./company-index";
import { DISCARDED_SINK_COMPANY_NAME } from "./company-origin";

export type CompanyResolver = {
  /** Existing company for the name/site, or a new `aggregator` one (radar off: no ATS known). */
  resolve(candidate: { name: string; website?: string | null }): { id: number; created: boolean };
  /** Company that holds leads discarded by the hard filters. */
  discardedSinkId(): number;
};

/** Loads the companies once; use one resolver per run so new companies are visible to later jobs. */
export function createCompanyResolver(): CompanyResolver {
  const index = new CompanyIndex(
    db
      .select({ id: companies.id, name: companies.name, website: companies.website })
      .from(companies)
      .all(),
  );
  let sinkId: number | null = null;

  return {
    resolve(candidate) {
      return index.resolve(candidate, ({ name, website }) => {
        const now = new Date();
        const row = db
          .insert(companies)
          .values({
            name,
            website,
            status: "monitoring",
            origin: "aggregator",
            radarEnabled: false,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: companies.id })
          .get();

        return row.id;
      });
    },
    discardedSinkId() {
      if (sinkId !== null) {
        return sinkId;
      }

      const existing = db
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.name, DISCARDED_SINK_COMPANY_NAME),
            eq(companies.origin, "aggregator"),
          ),
        )
        .get();

      if (existing) {
        sinkId = existing.id;
        return existing.id;
      }

      const now = new Date();
      const row = db
        .insert(companies)
        .values({
          name: DISCARDED_SINK_COMPANY_NAME,
          status: "discarded",
          origin: "aggregator",
          radarEnabled: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: companies.id })
        .get();

      sinkId = row.id;

      return row.id;
    },
  };
}
