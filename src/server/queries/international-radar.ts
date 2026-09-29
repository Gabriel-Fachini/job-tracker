import { and, gte, isNotNull, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { jobLeads } from "@/lib/db/schema";

export type InternationalRadarData = {
  /** Leads that went through the triage in the period. */
  total: number;
  /** Share (0-100) not discarded for location; null without leads. */
  eligiblePct: number | null;
  /** Leads by source (`company` = the company's own board). */
  bySource: Array<{ source: string; count: number }>;
  discardReasons: Array<{ reason: string; count: number }>;
  /** Median of the salary midpoints (USD/year) of eligible leads that state one. */
  medianSalaryUsdAnnual: number | null;
  salarySamples: number;
};

export type InternationalRadarRow = {
  sourceKind: string | null;
  discardReason: string | null;
  salaryMinUsdAnnual: number | null;
  salaryMaxUsdAnnual: number | null;
};

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** Pure aggregation, so it is testable without a database. */
export function summarizeInternationalRadar(rows: InternationalRadarRow[]): InternationalRadarData {
  const eligible = rows.filter((row) => row.discardReason !== "location_ineligible");
  const sources = new Map<string, number>();
  const reasons = new Map<string, number>();

  for (const row of rows) {
    const source = row.sourceKind ?? "other";

    sources.set(source, (sources.get(source) ?? 0) + 1);

    if (row.discardReason) {
      reasons.set(row.discardReason, (reasons.get(row.discardReason) ?? 0) + 1);
    }
  }

  const midpoints = eligible
    .map((row) => {
      const min = row.salaryMinUsdAnnual ?? row.salaryMaxUsdAnnual;
      const max = row.salaryMaxUsdAnnual ?? row.salaryMinUsdAnnual;

      return min !== null && max !== null ? (min + max) / 2 : null;
    })
    .filter((value): value is number => value !== null);

  return {
    total: rows.length,
    eligiblePct: rows.length > 0 ? Math.round((eligible.length / rows.length) * 100) : null,
    bySource: [...sources.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count),
    discardReasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count),
    medianSalaryUsdAnnual: median(midpoints),
    salarySamples: midpoints.length,
  };
}

export function getInternationalRadar(from: Date, to: Date): InternationalRadarData {
  const rows = db
    .select({
      sourceKind: jobLeads.sourceKind,
      discardReason: jobLeads.discardReason,
      salaryMinUsdAnnual: jobLeads.salaryMinUsdAnnual,
      salaryMaxUsdAnnual: jobLeads.salaryMaxUsdAnnual,
    })
    .from(jobLeads)
    .where(and(isNotNull(jobLeads.triageEngine), gte(jobLeads.discoveredAt, from), lt(jobLeads.discoveredAt, to)))
    .all();

  return summarizeInternationalRadar(rows);
}
