import { inArray } from "drizzle-orm";

import type { db } from "@/lib/db";
import {
  glassdoorInterviews,
  glassdoorReviews,
  glassdoorSalaries,
  glassdoorSnapshots,
} from "@/lib/db/schema";

type DatabaseLike = Pick<typeof db, "select" | "delete">;

/**
 * Removes everything Glassdoor collected for these companies. Foreign keys are
 * on and nothing cascades, so callers run this before deleting the companies.
 */
export function deleteGlassdoorDataForCompanies(
  tx: DatabaseLike,
  companyIds: number[],
) {
  if (companyIds.length === 0) {
    return;
  }

  tx.delete(glassdoorSalaries)
    .where(
      inArray(
        glassdoorSalaries.snapshotId,
        tx
          .select({ id: glassdoorSnapshots.id })
          .from(glassdoorSnapshots)
          .where(inArray(glassdoorSnapshots.companyId, companyIds)),
      ),
    )
    .run();
  tx.delete(glassdoorSnapshots)
    .where(inArray(glassdoorSnapshots.companyId, companyIds))
    .run();
  tx.delete(glassdoorReviews)
    .where(inArray(glassdoorReviews.companyId, companyIds))
    .run();
  tx.delete(glassdoorInterviews)
    .where(inArray(glassdoorInterviews.companyId, companyIds))
    .run();
}
