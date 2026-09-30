import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { searchPreferences } from "@/lib/db/schema";
import {
  searchPreferencesFromRow,
  type SearchPreferences,
  type SearchPreferencesInput,
} from "@/lib/search-preferences";

/** The single preferences row, or null when the user never saved any. */
export function getSearchPreferences(): SearchPreferences | null {
  const row = db
    .select()
    .from(searchPreferences)
    .orderBy(desc(searchPreferences.updatedAt), desc(searchPreferences.id))
    .limit(1)
    .get();

  return row ? searchPreferencesFromRow(row) : null;
}

/** Inserts or updates the single row. `input` must already be normalized. */
export function saveSearchPreferences(input: SearchPreferencesInput): SearchPreferences {
  const existing = db
    .select({ id: searchPreferences.id })
    .from(searchPreferences)
    .orderBy(desc(searchPreferences.id))
    .limit(1)
    .get();
  const now = new Date();
  const values = {
    minMonthlyUsd: input.minMonthlyUsd,
    minAnnualUsd: input.minAnnualUsd,
    acceptedContracts: JSON.stringify(input.acceptedContracts),
    acceptedEligibility: JSON.stringify(input.acceptedEligibility),
    timezone: input.timezone,
    maxUtcOffsetDistanceHours: input.maxUtcOffsetDistanceHours,
    targetSeniorities: JSON.stringify(input.targetSeniorities),
    targetJobFamilies: JSON.stringify(input.targetJobFamilies),
    titleIncludeKeywords: JSON.stringify(input.titleIncludeKeywords),
    titleExcludeKeywords: JSON.stringify(input.titleExcludeKeywords),
    defaultAnswers: JSON.stringify(input.defaultAnswers),
    updatedAt: now,
  };

  if (existing) {
    db.update(searchPreferences).set(values).where(eq(searchPreferences.id, existing.id)).run();
  } else {
    db.insert(searchPreferences).values(values).run();
  }

  return getSearchPreferences() as SearchPreferences;
}
