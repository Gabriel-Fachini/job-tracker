/**
 * Glassdoor payload, schema v1 (produced by `.claude/skills/glassdoor-collect`).
 *
 * `parseGlassdoorPayload` validates the shape and normalizes it: unknown or
 * missing optional values become `null`, and everything the app decided not to
 * store (logo, HQ, per-review votes, extreme percentiles...) is dropped here.
 */

export const GLASSDOOR_SCHEMA_VERSION = 1;

export const ratingKeys = [
  "overall",
  "culture_values",
  "work_life_balance",
  "compensation_benefits",
  "career_opportunities",
  "senior_management",
  "diversity_inclusion",
] as const;

export const shareKeys = [
  "recommend_to_friend",
  "business_outlook",
  "ceo_approval",
] as const;

export const benchmarkKeys = [...ratingKeys, ...shareKeys] as const;

export type BenchmarkKey = (typeof benchmarkKeys)[number];
export type RatingValues = Record<BenchmarkKey, number | null>;

export type PayloadEmployer = {
  glassdoorId: number;
  name: string;
  overviewUrl: string | null;
  website: string | null;
  /** Glassdoor's own label, e.g. "201 a 500 funcionários". */
  sizeLabel: string | null;
  sector: string | null;
  yearFounded: number | null;
};

export type PayloadReview = {
  id: number;
  date: string | null;
  jobTitle: string | null;
  location: string | null;
  isCurrent: boolean | null;
  yearsEmployed: number | null;
  rating: number | null;
  summary: string | null;
  pros: string | null;
  cons: string | null;
  advice: string | null;
};

export type PayloadInterview = {
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

export type PayloadPercentiles = {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
};

export type PayloadSalary = {
  jobTitle: string;
  count: number | null;
  mostRecent: string | null;
  base: PayloadPercentiles;
  total: PayloadPercentiles;
};

export type PayloadCompany = {
  employer: PayloadEmployer;
  ratings: RatingValues;
  reviewCount: number | null;
  industryBenchmark: Partial<RatingValues> | null;
  distribution: Record<string, Record<string, number>> | null;
  interviews: {
    total: number | null;
    difficultyAvg: number | null;
    experienceCounts: { positive: number | null; neutral: number | null; negative: number | null };
    channelCounts: Record<string, number> | null;
    items: PayloadInterview[];
  };
  reviews: PayloadReview[];
  salaries: PayloadSalary[];
};

export type GlassdoorPayload = {
  collectedAt: Date;
  since: string | null;
  errors: Array<{ glassdoorId: number | null; error: string }>;
  companies: PayloadCompany[];
};

export class GlassdoorPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlassdoorPayloadError";
  }
}

type Obj = Record<string, unknown>;

function fail(path: string, expected: string): never {
  throw new GlassdoorPayloadError(`Payload inválido em ${path}: esperado ${expected}.`);
}

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function obj(value: unknown, path: string): Obj {
  return isObj(value) ? value : fail(path, "objeto");
}

function arr(value: unknown, path: string): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : fail(path, "lista");
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function int(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) ? n : null;
}

function requiredInt(value: unknown, path: string): number {
  return int(value) ?? fail(path, "número inteiro");
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function ratingValues(source: unknown): RatingValues {
  const o = isObj(source) ? source : {};
  return Object.fromEntries(benchmarkKeys.map((key) => [key, num(o[key])])) as RatingValues;
}

function numberRecord(value: unknown): Record<string, number> | null {
  if (!isObj(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] => num(entry[1]) !== null,
  );
  return Object.fromEntries(entries);
}

function distribution(value: unknown): PayloadCompany["distribution"] {
  if (!isObj(value)) {
    return null;
  }

  const result: Record<string, Record<string, number>> = {};

  for (const [key, inner] of Object.entries(value)) {
    const record = numberRecord(inner);

    if (record) {
      result[key] = record;
    }
  }

  return result;
}

function percentiles(value: unknown): PayloadPercentiles {
  const o = isObj(value) ? value : {};
  return {
    p10: num(o.p10),
    p25: num(o.p25),
    p50: num(o.p50),
    p75: num(o.p75),
    p90: num(o.p90),
  };
}

function parseEmployer(value: unknown, path: string): PayloadEmployer {
  const o = obj(value, path);
  const name = str(o.name) ?? fail(`${path}.name`, "texto");

  return {
    glassdoorId: requiredInt(o.glassdoor_id, `${path}.glassdoor_id`),
    name,
    overviewUrl: str(o.overview_url),
    website: str(o.website),
    sizeLabel: str(o.size),
    sector: str(o.sector),
    yearFounded: int(o.year_founded),
  };
}

function parseReview(value: unknown, path: string): PayloadReview {
  const o = obj(value, path);

  return {
    id: requiredInt(o.id, `${path}.id`),
    date: str(o.date),
    jobTitle: str(o.job_title),
    location: str(o.location),
    isCurrent: bool(o.is_current),
    yearsEmployed: int(o.years_employed),
    rating: int(o.rating),
    summary: str(o.summary),
    pros: str(o.pros),
    cons: str(o.cons),
    advice: str(o.advice),
  };
}

function parseInterview(value: unknown, path: string): PayloadInterview {
  const o = obj(value, path);

  return {
    id: requiredInt(o.id, `${path}.id`),
    date: str(o.date),
    jobTitle: str(o.job_title),
    difficulty: str(o.difficulty),
    experience: str(o.experience),
    outcome: str(o.outcome),
    durationDays: int(o.duration_days),
    process: str(o.process),
    questions: arr(o.questions, `${path}.questions`).filter(
      (question): question is string => typeof question === "string" && question.trim() !== "",
    ),
  };
}

function parseSalary(value: unknown, path: string): PayloadSalary | null {
  const o = obj(value, path);
  const jobTitle = str(o.job_title);

  // A row without a title carries no meaning; skip it instead of failing the import.
  if (!jobTitle) {
    return null;
  }

  return {
    jobTitle,
    count: int(o.count),
    mostRecent: str(o.most_recent),
    base: percentiles(o.base),
    total: percentiles(o.total),
  };
}

function parseCompany(value: unknown, path: string): PayloadCompany {
  const o = obj(value, path);
  const ratings = isObj(o.ratings) ? o.ratings : {};
  const interviews = isObj(o.interviews) ? o.interviews : {};
  const experience = isObj(interviews.experience_counts) ? interviews.experience_counts : {};
  const reviews = isObj(o.reviews) ? o.reviews : {};
  const salaries = isObj(o.salaries) ? o.salaries : {};

  return {
    employer: parseEmployer(o.employer, `${path}.employer`),
    ratings: ratingValues(ratings),
    reviewCount: int(ratings.review_count),
    industryBenchmark: isObj(ratings.industry_benchmark)
      ? ratingValues(ratings.industry_benchmark)
      : null,
    distribution: distribution(ratings.distribution),
    interviews: {
      total: int(interviews.total),
      difficultyAvg: num(interviews.difficulty_avg),
      experienceCounts: {
        positive: int(experience.POSITIVE),
        neutral: int(experience.NEUTRAL),
        negative: int(experience.NEGATIVE),
      },
      channelCounts: numberRecord(interviews.channel_counts),
      items: arr(interviews.items, `${path}.interviews.items`).map((item, index) =>
        parseInterview(item, `${path}.interviews.items[${index}]`),
      ),
    },
    reviews: arr(reviews.items, `${path}.reviews.items`).map((item, index) =>
      parseReview(item, `${path}.reviews.items[${index}]`),
    ),
    salaries: arr(salaries.items, `${path}.salaries.items`)
      .map((item, index) => parseSalary(item, `${path}.salaries.items[${index}]`))
      .filter((item): item is PayloadSalary => item !== null),
  };
}

/** Throws `GlassdoorPayloadError` (pt-BR message) when the payload is not a valid v1 file. */
export function parseGlassdoorPayload(input: unknown): GlassdoorPayload {
  const root = obj(input, "raiz");

  if (root.schema_version !== GLASSDOOR_SCHEMA_VERSION) {
    throw new GlassdoorPayloadError(
      `schema_version ${JSON.stringify(root.schema_version ?? null)} não suportado (esperado ${GLASSDOOR_SCHEMA_VERSION}).`,
    );
  }

  if (root.source !== "glassdoor") {
    fail("source", '"glassdoor"');
  }

  const collectedAtText = str(root.collected_at) ?? fail("collected_at", "data ISO");
  const collectedAt = new Date(collectedAtText);

  if (Number.isNaN(collectedAt.getTime())) {
    fail("collected_at", "data ISO");
  }

  const companies = arr(root.companies, "companies");

  if (companies.length === 0) {
    fail("companies", "ao menos uma empresa");
  }

  return {
    collectedAt,
    since: str(root.since),
    errors: arr(root.errors, "errors").map((entry) => {
      const o = isObj(entry) ? entry : {};
      return {
        glassdoorId: int(o.glassdoor_id),
        error: str(o.error) ?? "erro desconhecido",
      };
    }),
    companies: companies.map((company, index) =>
      parseCompany(company, `companies[${index}]`),
    ),
  };
}
