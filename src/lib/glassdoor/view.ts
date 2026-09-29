/**
 * Shapes the company page renders for Glassdoor. Plain data only (safe to send
 * to client components) plus the pure helpers that derive charts from it.
 */
import type { BenchmarkKey } from "./payload";

export type RatingsView = Record<BenchmarkKey, number | null>;

export type GlassdoorReviewItem = {
  id: number;
  date: string | null;
  jobTitle: string | null;
  location: string | null;
  rating: number | null;
  summary: string | null;
  pros: string | null;
  cons: string | null;
  advice: string | null;
  isCurrent: boolean | null;
  yearsEmployed: number | null;
};

export type GlassdoorInterviewItem = {
  id: number;
  date: string | null;
  jobTitle: string | null;
  difficulty: string | null;
  experience: string | null;
  outcome: string | null;
  durationDays: number | null;
  process: string | null;
  questions: string[];
};

export type GlassdoorSalaryItem = {
  jobTitle: string;
  count: number | null;
  mostRecent: string | null;
  base: SalaryBand;
  total: SalaryBand;
};

export type SalaryBand = {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
};

export type TrendPoint = { year: string; count: number; average: number };

export type GlassdoorView = {
  collectedAt: string;
  snapshotCount: number;
  overviewUrl: string | null;
  yearFounded: number | null;
  ratings: RatingsView;
  reviewCount: number | null;
  previous: { collectedAt: string; ratings: RatingsView } | null;
  benchmark: Partial<RatingsView> | null;
  /** Overall rating distribution, index 0 = 1 star. */
  distribution: number[] | null;
  trend: {
    years: TrendPoint[];
    last12: { count: number; average: number } | null;
    /** Reviews the yearly chart was computed from. */
    sample: number;
  };
  interviews: {
    count: number | null;
    difficulty: number | null;
    positive: number | null;
    neutral: number | null;
    negative: number | null;
    channelCounts: Record<string, number> | null;
    medianDurationDays: number | null;
    accepted: number;
    items: GlassdoorInterviewItem[];
  };
  reviews: GlassdoorReviewItem[];
  storedReviewCount: number;
  salaries: GlassdoorSalaryItem[];
};

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Average rating per calendar year (the direction of the company). */
export function computeYearlyTrend(
  rows: Array<{ date: string | null; rating: number | null }>,
  now: Date,
): GlassdoorView["trend"] {
  const byYear = new Map<string, number[]>();
  const cutoff = now.getTime() - 365 * 24 * 60 * 60 * 1000;
  const recent: number[] = [];

  for (const { date, rating } of rows) {
    if (!date || rating === null) {
      continue;
    }

    const year = date.slice(0, 4);

    if (!/^\d{4}$/.test(year)) {
      continue;
    }

    byYear.set(year, [...(byYear.get(year) ?? []), rating]);

    const time = Date.parse(date);

    if (Number.isFinite(time) && time >= cutoff) {
      recent.push(rating);
    }
  }

  const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

  return {
    years: [...byYear.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, values]) => ({ year, count: values.length, average: average(values) })),
    last12: recent.length > 0 ? { count: recent.length, average: average(recent) } : null,
    sample: rows.length,
  };
}
