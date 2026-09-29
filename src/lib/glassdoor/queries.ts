import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  glassdoorInterviews,
  glassdoorReviews,
  glassdoorSalaries,
  glassdoorSnapshots,
} from "@/lib/db/schema";

import { benchmarkKeys, type BenchmarkKey } from "./payload";
import {
  computeYearlyTrend,
  median,
  type GlassdoorView,
  type RatingsView,
  type SalaryBand,
} from "./view";

// Keeps the RSC payload bounded for companies with thousands of reviews.
const REVIEW_LIST_LIMIT = 200;
const INTERVIEW_LIST_LIMIT = 200;

type Snapshot = typeof glassdoorSnapshots.$inferSelect;

function ratingsOf(snapshot: Snapshot): RatingsView {
  const values: Record<BenchmarkKey, number | null> = {
    overall: snapshot.overall,
    culture_values: snapshot.cultureValues,
    work_life_balance: snapshot.workLifeBalance,
    compensation_benefits: snapshot.compensationBenefits,
    career_opportunities: snapshot.careerOpportunities,
    senior_management: snapshot.seniorManagement,
    diversity_inclusion: snapshot.diversityInclusion,
    recommend_to_friend: snapshot.recommendToFriend,
    business_outlook: snapshot.businessOutlook,
    ceo_approval: snapshot.ceoApproval,
  };

  return values;
}

function parseJson<T>(text: string | null | undefined): T | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

type SnapshotData = {
  employer?: { overview_url?: string | null; year_founded?: number | null };
  industry_benchmark?: Partial<Record<BenchmarkKey, number | null>> | null;
  distribution?: Record<string, Record<string, number>> | null;
  interview_channel_counts?: Record<string, number> | null;
};

/** Everything the company page shows for Glassdoor, or `null` before the first import. */
export function getGlassdoorView(companyId: number, now = new Date()): GlassdoorView | null {
  const snapshots = db
    .select()
    .from(glassdoorSnapshots)
    .where(eq(glassdoorSnapshots.companyId, companyId))
    .orderBy(desc(glassdoorSnapshots.collectedAt))
    .all();
  const latest = snapshots[0];

  if (!latest) {
    return null;
  }

  const previous = snapshots[1];
  const data = parseJson<SnapshotData>(latest.dataJson) ?? {};
  const overall = data.distribution?.overall;
  const benchmark = data.industry_benchmark ?? null;

  const trendRows = db
    .select({ date: glassdoorReviews.date, rating: glassdoorReviews.rating })
    .from(glassdoorReviews)
    .where(eq(glassdoorReviews.companyId, companyId))
    .all();

  const reviews = db
    .select()
    .from(glassdoorReviews)
    .where(eq(glassdoorReviews.companyId, companyId))
    .orderBy(desc(glassdoorReviews.date))
    .limit(REVIEW_LIST_LIMIT)
    .all()
    .map((row) => ({
      id: row.glassdoorReviewId,
      date: row.date,
      jobTitle: row.jobTitle,
      location: parseJson<{ location?: string | null }>(row.extraJson)?.location ?? null,
      rating: row.rating,
      summary: row.summary,
      pros: row.pros,
      cons: row.cons,
      advice: row.advice,
      isCurrent: row.isCurrent,
      yearsEmployed: row.yearsEmployed,
    }));

  const interviewRows = db
    .select()
    .from(glassdoorInterviews)
    .where(eq(glassdoorInterviews.companyId, companyId))
    .orderBy(desc(glassdoorInterviews.date))
    .limit(INTERVIEW_LIST_LIMIT)
    .all();

  const interviewItems = interviewRows.map((row) => ({
    id: row.glassdoorInterviewId,
    date: row.date,
    jobTitle: row.jobTitle,
    difficulty: row.difficulty,
    experience: row.experience,
    outcome: row.outcome,
    durationDays: row.durationDays,
    process: row.process,
    questions: parseJson<string[]>(row.questionsJson) ?? [],
  }));

  const salaryRows = db
    .select()
    .from(glassdoorSalaries)
    .where(eq(glassdoorSalaries.snapshotId, latest.id))
    .all();

  const band = (row: (typeof salaryRows)[number], kind: "base" | "total"): SalaryBand => ({
    p10: row[`${kind}P10`],
    p25: row[`${kind}P25`],
    p50: row[`${kind}P50`],
    p75: row[`${kind}P75`],
    p90: row[`${kind}P90`],
  });

  return {
    collectedAt: latest.collectedAt.toISOString(),
    snapshotCount: snapshots.length,
    overviewUrl: data.employer?.overview_url ?? null,
    yearFounded: data.employer?.year_founded ?? null,
    ratings: ratingsOf(latest),
    reviewCount: latest.reviewCount,
    previous: previous
      ? { collectedAt: previous.collectedAt.toISOString(), ratings: ratingsOf(previous) }
      : null,
    benchmark: benchmark
      ? (Object.fromEntries(
          benchmarkKeys.map((key) => [key, benchmark[key] ?? null]),
        ) as Partial<RatingsView>)
      : null,
    distribution: overall ? [1, 2, 3, 4, 5].map((star) => overall[`_${star}`] ?? 0) : null,
    trend: computeYearlyTrend(trendRows, now),
    interviews: {
      count: latest.interviewCount,
      difficulty: latest.interviewDifficulty,
      positive: latest.interviewPositive,
      neutral: latest.interviewNeutral,
      negative: latest.interviewNegative,
      channelCounts: data.interview_channel_counts ?? null,
      medianDurationDays: median(
        interviewItems
          .map((item) => item.durationDays)
          .filter((value): value is number => typeof value === "number" && value > 0),
      ),
      accepted: interviewItems.filter((item) => item.outcome === "ACCEPT_OFFER").length,
      items: interviewItems,
    },
    reviews,
    storedReviewCount: trendRows.length,
    salaries: salaryRows.map((row) => ({
      jobTitle: row.jobTitle,
      count: row.salaryCount,
      mostRecent: parseJson<{ most_recent?: string | null }>(row.extraJson)?.most_recent ?? null,
      base: band(row, "base"),
      total: band(row, "total"),
    })),
  };
}
