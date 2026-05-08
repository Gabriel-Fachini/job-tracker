import { and, count, gte, lt, ne, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { applications, jobLeads, resumes } from "@/lib/db/schema";

export type DashboardRange = "30d" | "90d" | "all";

export function resolvePeriod(range: DashboardRange): {
  from: Date;
  to: Date;
  prevFrom: Date | null;
  prevTo: Date | null;
} {
  const now = new Date();
  if (range === "all") {
    return { from: new Date(0), to: now, prevFrom: null, prevTo: null };
  }
  const days = range === "30d" ? 30 : 90;
  const ms = days * 24 * 60 * 60 * 1000;
  const from = new Date(now.getTime() - ms);
  const prevFrom = new Date(from.getTime() - ms);
  return { from, to: now, prevFrom, prevTo: from };
}

export type KpiData = {
  leadsDiscovered: number;
  leadsReviewed: number;
  appsCreated: number;
  resumesGenerated: number;
};

export function getKpiData(from: Date, to: Date): KpiData {
  const leadsDiscovered =
    db
      .select({ c: count() })
      .from(jobLeads)
      .where(
        and(
          gte(jobLeads.discoveredAt, from),
          lt(jobLeads.discoveredAt, to),
          ne(jobLeads.classificationStatus, "discarded"),
        ),
      )
      .get()?.c ?? 0;

  const leadsReviewed =
    db
      .select({ c: count() })
      .from(jobLeads)
      .where(
        and(
          gte(jobLeads.userDecisionAt, from),
          lt(jobLeads.userDecisionAt, to),
        ),
      )
      .get()?.c ?? 0;

  const appsCreated =
    db
      .select({ c: count() })
      .from(applications)
      .where(
        and(gte(applications.createdAt, from), lt(applications.createdAt, to)),
      )
      .get()?.c ?? 0;

  const resumesGenerated =
    db
      .select({ c: count() })
      .from(resumes)
      .where(and(gte(resumes.generatedAt, from), lt(resumes.generatedAt, to)))
      .get()?.c ?? 0;

  return { leadsDiscovered, leadsReviewed, appsCreated, resumesGenerated };
}

export type BacklogData = {
  total: number;
  oldestDate: Date | null;
  buckets: {
    lt24h: number;
    d1to3: number;
    d3to7: number;
    gt7d: number;
  };
};

export function getBacklogData(): BacklogData {
  const now = new Date();

  const pending = db
    .select({ discoveredAt: jobLeads.discoveredAt })
    .from(jobLeads)
    .where(
      and(
        eq(jobLeads.userDecision, "none"),
        ne(jobLeads.classificationStatus, "discarded"),
      ),
    )
    .all();

  const buckets = { lt24h: 0, d1to3: 0, d3to7: 0, gt7d: 0 };
  let oldestDate: Date | null = null;

  for (const lead of pending) {
    if (!oldestDate || lead.discoveredAt < oldestDate) {
      oldestDate = lead.discoveredAt;
    }
    const hours =
      (now.getTime() - lead.discoveredAt.getTime()) / (1000 * 60 * 60);
    if (hours < 24) buckets.lt24h++;
    else if (hours < 72) buckets.d1to3++;
    else if (hours < 168) buckets.d3to7++;
    else buckets.gt7d++;
  }

  return { total: pending.length, oldestDate, buckets };
}

export type TimelineDay = {
  date: string;
  total: number;
  interesting: number;
  discarded: number;
};

export function getRadarTimeline(from: Date, to: Date): TimelineDay[] {
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const rows = db.all(sql`
    SELECT
      strftime('%Y-%m-%d', datetime(discovered_at, 'unixepoch')) as date,
      count(*) as total,
      sum(case when classification_status = 'interesting' then 1 else 0 end) as interesting,
      sum(case when classification_status = 'discarded' then 1 else 0 end) as discarded
    FROM job_leads
    WHERE discovered_at >= ${fromSec} AND discovered_at < ${toSec}
    GROUP BY date
    ORDER BY date ASC
  `) as TimelineDay[];
  return rows;
}

export type ClassificationDist = {
  interesting: number;
  review: number;
  discarded: number;
  total: number;
};

export function getClassificationDist(
  from: Date,
  to: Date,
): ClassificationDist {
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const rows = db.all(sql`
    SELECT classification_status as status, count(*) as c
    FROM job_leads
    WHERE discovered_at >= ${fromSec} AND discovered_at < ${toSec}
    GROUP BY classification_status
  `) as { status: string; c: number }[];

  const dist = { interesting: 0, review: 0, discarded: 0, total: 0 };
  for (const row of rows) {
    if (row.status === "interesting") dist.interesting = row.c;
    else if (row.status === "review") dist.review = row.c;
    else if (row.status === "discarded") dist.discarded = row.c;
    dist.total += row.c;
  }
  return dist;
}

export type ScoreBucket = { bucket: string; count: number };

export function getScoreHistogram(from: Date, to: Date): ScoreBucket[] {
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const rows = db.all(sql`
    SELECT
      (classification_score / 10) * 10 as bucket_start,
      count(*) as c
    FROM job_leads
    WHERE discovered_at >= ${fromSec}
      AND discovered_at < ${toSec}
      AND classification_score IS NOT NULL
    GROUP BY bucket_start
    ORDER BY bucket_start ASC
  `) as { bucket_start: number; c: number }[];

  return rows.map((r) => ({
    bucket: `${r.bucket_start}-${r.bucket_start + 9}`,
    count: r.c,
  }));
}

export type FunnelData = {
  discovered: number;
  interesting: number;
  promoted: number;
  applied: number;
};

export function getFunnelData(from: Date, to: Date): FunnelData {
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);

  const leadsRow = db.get(sql`
    SELECT
      count(*) as discovered,
      sum(case when classification_status = 'interesting' then 1 else 0 end) as interesting,
      sum(case when promoted_to_application_id IS NOT NULL then 1 else 0 end) as promoted
    FROM job_leads
    WHERE discovered_at >= ${fromSec}
      AND discovered_at < ${toSec}
      AND classification_status != 'discarded'
  `) as { discovered: number; interesting: number; promoted: number };

  const appliedRow = db.get(sql`
    SELECT count(*) as applied FROM applications
    WHERE created_at >= ${fromSec} AND created_at < ${toSec}
  `) as { applied: number };

  return {
    discovered: leadsRow?.discovered ?? 0,
    interesting: leadsRow?.interesting ?? 0,
    promoted: leadsRow?.promoted ?? 0,
    applied: appliedRow?.applied ?? 0,
  };
}

export type WorkModelMatchData = {
  preference: string | null;
  leadsDist: { workModel: string; count: number }[];
  nullCount: number;
  total: number;
};

export function getWorkModelMatch(from: Date, to: Date): WorkModelMatchData {
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);

  const prefRow = db.get(sql`
    SELECT work_model_preference FROM profile LIMIT 1
  `) as { work_model_preference: string | null } | undefined;

  const rows = db.all(sql`
    SELECT work_model, count(*) as c
    FROM job_leads
    WHERE discovered_at >= ${fromSec} AND discovered_at < ${toSec}
      AND classification_status != 'discarded'
    GROUP BY work_model
    ORDER BY c DESC
  `) as { work_model: string | null; c: number }[];

  const nullCount = rows.find((r) => r.work_model === null)?.c ?? 0;
  const leadsDist = rows
    .filter((r) => r.work_model !== null)
    .map((r) => ({ workModel: r.work_model as string, count: r.c }));
  const total = rows.reduce((s, r) => s + r.c, 0);

  return {
    preference: prefRow?.work_model_preference ?? null,
    leadsDist,
    nullCount,
    total,
  };
}

export type ClassifierQualityData = {
  total: number;
  interestingPromoted: number;
  interestingTotal: number;
  discardedOverridden: number;
  discardedTotal: number;
  reviewPromoted: number;
  reviewOther: number;
  reviewTotal: number;
};

export function getClassifierQuality(): ClassifierQualityData {
  const rows = db.all(sql`
    SELECT classification_status, user_decision, count(*) as c
    FROM job_leads
    WHERE user_decision != 'none'
    GROUP BY classification_status, user_decision
  `) as { classification_status: string; user_decision: string; c: number }[];

  let total = 0;
  let interestingPromoted = 0,
    interestingTotal = 0;
  let discardedOverridden = 0,
    discardedTotal = 0;
  let reviewPromoted = 0,
    reviewOther = 0,
    reviewTotal = 0;

  const isPositive = (d: string) => d === "promoted" || d === "approved";

  for (const row of rows) {
    total += row.c;
    if (row.classification_status === "interesting") {
      interestingTotal += row.c;
      if (isPositive(row.user_decision)) interestingPromoted += row.c;
    } else if (row.classification_status === "discarded") {
      discardedTotal += row.c;
      if (isPositive(row.user_decision)) discardedOverridden += row.c;
    } else if (row.classification_status === "review") {
      reviewTotal += row.c;
      if (isPositive(row.user_decision)) reviewPromoted += row.c;
      else reviewOther += row.c;
    }
  }

  return {
    total,
    interestingPromoted,
    interestingTotal,
    discardedOverridden,
    discardedTotal,
    reviewPromoted,
    reviewOther,
    reviewTotal,
  };
}

export type CompanyRow = {
  id: number;
  name: string;
  leads: number;
  interestingCount: number;
  interestingPct: number;
  avgScore: number | null;
  apps: number;
};

export function getTopCompanies(from: Date, to: Date): CompanyRow[] {
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);

  const rows = db.all(sql`
    SELECT
      c.id,
      c.name,
      count(jl.id) as leads,
      sum(case when jl.classification_status = 'interesting' then 1 else 0 end) as interesting_count,
      avg(jl.classification_score) as avg_score
    FROM companies c
    LEFT JOIN job_leads jl ON jl.company_id = c.id
      AND jl.discovered_at >= ${fromSec}
      AND jl.discovered_at < ${toSec}
      AND jl.classification_status != 'discarded'
    WHERE c.status != 'archived'
    GROUP BY c.id
    HAVING count(jl.id) > 0
    ORDER BY count(jl.id) DESC
    LIMIT 20
  `) as {
    id: number;
    name: string;
    leads: number;
    interesting_count: number;
    avg_score: number | null;
  }[];

  const appsRows = db.all(sql`
    SELECT j.company_id, count(a.id) as apps
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.created_at >= ${fromSec} AND a.created_at < ${toSec}
    GROUP BY j.company_id
  `) as { company_id: number; apps: number }[];

  const appsMap = new Map(appsRows.map((r) => [r.company_id, r.apps]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    leads: r.leads,
    interestingCount: r.interesting_count,
    interestingPct:
      r.leads > 0 ? Math.round((r.interesting_count / r.leads) * 100) : 0,
    avgScore: r.avg_score != null ? Math.round(r.avg_score) : null,
    apps: appsMap.get(r.id) ?? 0,
  }));
}
