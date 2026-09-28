import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  companies,
  glassdoorInterviews,
  glassdoorReviews,
  glassdoorSalaries,
  glassdoorSnapshots,
} from "@/lib/db/schema";

import { mapGlassdoorSize } from "./identity";
import { findCompanyForGlassdoor } from "./match";
import {
  parseGlassdoorPayload,
  type PayloadCompany,
} from "./payload";

export type GlassdoorCompanyImportResult = {
  companyId: number;
  companyName: string;
  action: "created" | "updated";
  glassdoorId: number;
  snapshotId: number;
  newReviews: number;
  newInterviews: number;
  skippedDuplicateSnapshot: boolean;
};

export type GlassdoorImportResult = {
  companies: GlassdoorCompanyImportResult[];
  /** Per-company failures the collector reported; passed through untouched. */
  errors: Array<{ glassdoorId: number | null; error: string }>;
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Imports a schema v1 payload. Validates it (throws `GlassdoorPayloadError`),
 * then writes each company in its own transaction, so re-importing the same
 * file changes nothing.
 */
export function importGlassdoorPayload(input: unknown): GlassdoorImportResult {
  const payload = parseGlassdoorPayload(input);

  return {
    companies: payload.companies.map((company) =>
      db.transaction((tx) =>
        importCompany(tx, company, payload.collectedAt, payload.since),
      ),
    ),
    errors: payload.errors,
  };
}

function isEmpty(value: string | null | undefined) {
  return value === null || value === undefined || value.trim() === "";
}

function isHttpUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function importCompany(
  tx: Transaction,
  data: PayloadCompany,
  collectedAt: Date,
  since: string | null,
): GlassdoorCompanyImportResult {
  const { employer } = data;
  const now = new Date();
  const website = isHttpUrl(employer.website) ? employer.website : null;
  const overviewUrl = isHttpUrl(employer.overviewUrl) ? employer.overviewUrl : null;
  const size = mapGlassdoorSize(employer.sizeLabel);

  const existing = findCompanyForGlassdoor(tx, {
    glassdoorId: employer.glassdoorId,
    name: employer.name,
  });

  let companyId: number;
  let companyName: string;
  let action: "created" | "updated";

  if (existing) {
    action = "updated";
    companyId = existing.id;
    // The user's own registration wins: only empty fields are completed, and
    // the name is never touched.
    companyName = existing.name;
    const fill = {
      ...(isEmpty(existing.website) && website ? { website } : {}),
      ...(isEmpty(existing.size) && size ? { size } : {}),
      ...(isEmpty(existing.sector) && employer.sector ? { sector: employer.sector } : {}),
      ...(isEmpty(existing.glassdoorUrl) && overviewUrl ? { glassdoorUrl: overviewUrl } : {}),
    };

    if (Object.keys(fill).length > 0) {
      tx.update(companies)
        .set({ ...fill, updatedAt: now })
        .where(eq(companies.id, existing.id))
        .run();
    }
  } else {
    action = "created";
    companyName = employer.name;
    companyId = tx
      .insert(companies)
      .values({
        name: employer.name,
        website,
        size,
        sector: employer.sector,
        glassdoorUrl: overviewUrl,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: companies.id })
      .get().id;
  }

  const existingSnapshot = tx
    .select({ id: glassdoorSnapshots.id })
    .from(glassdoorSnapshots)
    .where(
      and(
        eq(glassdoorSnapshots.companyId, companyId),
        eq(glassdoorSnapshots.collectedAt, collectedAt),
      ),
    )
    .get();

  let snapshotId: number;

  if (existingSnapshot) {
    snapshotId = existingSnapshot.id;
  } else {
    snapshotId = insertSnapshot(tx, companyId, data, collectedAt, since, now);
  }

  const newReviews = insertReviews(tx, companyId, data, now);
  const newInterviews = insertInterviews(tx, companyId, data, now);

  return {
    companyId,
    companyName,
    action,
    glassdoorId: employer.glassdoorId,
    snapshotId,
    newReviews,
    newInterviews,
    skippedDuplicateSnapshot: Boolean(existingSnapshot),
  };
}

function insertSnapshot(
  tx: Transaction,
  companyId: number,
  data: PayloadCompany,
  collectedAt: Date,
  since: string | null,
  now: Date,
) {
  const { employer, ratings, interviews } = data;

  const snapshotId = tx
    .insert(glassdoorSnapshots)
    .values({
      companyId,
      glassdoorId: employer.glassdoorId,
      collectedAt,
      since,
      overall: ratings.overall,
      cultureValues: ratings.culture_values,
      workLifeBalance: ratings.work_life_balance,
      compensationBenefits: ratings.compensation_benefits,
      careerOpportunities: ratings.career_opportunities,
      seniorManagement: ratings.senior_management,
      diversityInclusion: ratings.diversity_inclusion,
      recommendToFriend: ratings.recommend_to_friend,
      businessOutlook: ratings.business_outlook,
      ceoApproval: ratings.ceo_approval,
      reviewCount: data.reviewCount,
      interviewDifficulty: interviews.difficultyAvg,
      interviewPositive: interviews.experienceCounts.positive,
      interviewNeutral: interviews.experienceCounts.neutral,
      interviewNegative: interviews.experienceCounts.negative,
      interviewCount: interviews.total,
      dataJson: JSON.stringify({
        employer: {
          name: employer.name,
          glassdoor_id: employer.glassdoorId,
          overview_url: employer.overviewUrl,
          year_founded: employer.yearFounded,
        },
        industry_benchmark: data.industryBenchmark,
        distribution: data.distribution,
        interview_channel_counts: interviews.channelCounts,
      }),
      createdAt: now,
    })
    .returning({ id: glassdoorSnapshots.id })
    .get().id;

  for (const salary of data.salaries) {
    tx.insert(glassdoorSalaries)
      .values({
        snapshotId,
        jobTitle: salary.jobTitle,
        salaryCount: salary.count,
        baseP10: salary.base.p10,
        baseP25: salary.base.p25,
        baseP50: salary.base.p50,
        baseP75: salary.base.p75,
        baseP90: salary.base.p90,
        totalP10: salary.total.p10,
        totalP25: salary.total.p25,
        totalP50: salary.total.p50,
        totalP75: salary.total.p75,
        totalP90: salary.total.p90,
        extraJson: JSON.stringify({ most_recent: salary.mostRecent }),
      })
      .run();
  }

  return snapshotId;
}

function insertReviews(
  tx: Transaction,
  companyId: number,
  data: PayloadCompany,
  now: Date,
) {
  let inserted = 0;

  for (const review of data.reviews) {
    const rows = tx
      .insert(glassdoorReviews)
      .values({
        companyId,
        glassdoorReviewId: review.id,
        date: review.date,
        jobTitle: review.jobTitle,
        rating: review.rating,
        summary: review.summary,
        pros: review.pros,
        cons: review.cons,
        advice: review.advice,
        isCurrent: review.isCurrent,
        yearsEmployed: review.yearsEmployed,
        extraJson: JSON.stringify({ location: review.location }),
        firstSeenAt: now,
      })
      .onConflictDoNothing({ target: glassdoorReviews.glassdoorReviewId })
      .returning({ id: glassdoorReviews.id })
      .all();

    inserted += rows.length;
  }

  return inserted;
}

function insertInterviews(
  tx: Transaction,
  companyId: number,
  data: PayloadCompany,
  now: Date,
) {
  let inserted = 0;

  for (const interview of data.interviews.items) {
    const rows = tx
      .insert(glassdoorInterviews)
      .values({
        companyId,
        glassdoorInterviewId: interview.id,
        date: interview.date,
        jobTitle: interview.jobTitle,
        difficulty: interview.difficulty,
        experience: interview.experience,
        outcome: interview.outcome,
        durationDays: interview.durationDays,
        process: interview.process,
        questionsJson: JSON.stringify(interview.questions),
        firstSeenAt: now,
      })
      .onConflictDoNothing({ target: glassdoorInterviews.glassdoorInterviewId })
      .returning({ id: glassdoorInterviews.id })
      .all();

    inserted += rows.length;
  }

  return inserted;
}
