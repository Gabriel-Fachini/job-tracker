import { eq, max, notInArray } from "drizzle-orm";

import { radarSkippedCompanyStatuses } from "@/lib/companies";
import { db } from "@/lib/db";
import {
  companies,
  glassdoorInterviews,
  glassdoorReviews,
  glassdoorSnapshots,
} from "@/lib/db/schema";

import { findCompanyForGlassdoor, knownGlassdoorId } from "./match";

export type GlassdoorTarget = {
  companyId: number | null;
  name: string;
  glassdoorId: number | null;
  glassdoorUrl: string | null;
  /** ISO timestamp of the latest snapshot. */
  lastCollectedAt: string | null;
  latestReviewDate: string | null;
  latestInterviewDate: string | null;
};

type CompanyRow = typeof companies.$inferSelect;

// `max` over a timestamp column is decoded by Drizzle, but stay tolerant of raw seconds.
function toDate(value: Date | number | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value instanceof Date ? value : new Date(value * 1000);
}

function targetFor(company: CompanyRow): GlassdoorTarget {
  const lastSnapshot = db
    .select({ collectedAt: max(glassdoorSnapshots.collectedAt) })
    .from(glassdoorSnapshots)
    .where(eq(glassdoorSnapshots.companyId, company.id))
    .get();
  const latestReview = db
    .select({ date: max(glassdoorReviews.date) })
    .from(glassdoorReviews)
    .where(eq(glassdoorReviews.companyId, company.id))
    .get();
  const latestInterview = db
    .select({ date: max(glassdoorInterviews.date) })
    .from(glassdoorInterviews)
    .where(eq(glassdoorInterviews.companyId, company.id))
    .get();
  const collectedAt = toDate(lastSnapshot?.collectedAt);

  return {
    companyId: company.id,
    name: company.name,
    glassdoorId: knownGlassdoorId(db, company),
    glassdoorUrl: company.glassdoorUrl,
    lastCollectedAt: collectedAt ? collectedAt.toISOString() : null,
    latestReviewDate: latestReview?.date ?? null,
    latestInterviewDate: latestInterview?.date ?? null,
  };
}

/**
 * What the collector skill needs to decide between a full collection and an
 * incremental one. With a `glassdoorId` and/or `name`: that one company (or a
 * single entry with `companyId: null` when nothing matches). With neither: every
 * registered company the bulk radar would not skip.
 */
export function getGlassdoorTargets(
  filter: { glassdoorId?: number | null; name?: string | null } = {},
): GlassdoorTarget[] {
  const glassdoorId = filter.glassdoorId ?? null;
  const name = filter.name?.trim() || null;

  if (glassdoorId || name) {
    const company = findCompanyForGlassdoor(db, { glassdoorId, name });

    if (company) {
      return [targetFor(company)];
    }

    return [
      {
        companyId: null,
        name: name ?? "",
        glassdoorId,
        glassdoorUrl: null,
        lastCollectedAt: null,
        latestReviewDate: null,
        latestInterviewDate: null,
      },
    ];
  }

  return db
    .select()
    .from(companies)
    .where(notInArray(companies.status, radarSkippedCompanyStatuses))
    .orderBy(companies.name)
    .all()
    .map(targetFor);
}

