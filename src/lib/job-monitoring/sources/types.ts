export const sourceKinds = [
  "himalayas",
  "remoteok",
  "weworkremotely",
  "jobicy",
  "hn_whoishiring",
] as const;

export type SourceKind = (typeof sourceKinds)[number];

export function isSourceKind(value: string): value is SourceKind {
  return (sourceKinds as readonly string[]).includes(value);
}

export type SourceSalaryPeriod = "year" | "month" | "hour";

/** One vacancy as an aggregated feed reports it, before it becomes a lead. */
export type SourceJob = {
  sourceKind: SourceKind;
  /** Stable id inside the source (guid, numeric id, comment id). */
  externalId: string;
  /** Public page of the vacancy (also the lead's `source_url`). */
  url: string;
  applyUrl?: string;
  title: string;
  companyName: string;
  companyWebsite?: string;
  descriptionHtml?: string;
  descriptionText?: string;
  locationText?: string;
  /** Countries or regions the employer restricts hiring to; empty/absent = not stated. */
  locationRestrictions?: string[];
  /** UTC offsets (hours) the employer accepts. */
  timezoneRestrictions?: number[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: SourceSalaryPeriod;
  };
  seniority?: string;
  employmentType?: string;
  publishedAt?: Date;
};

/** Per-source knobs (`job_sources.config`, JSON). Unknown keys are ignored. */
export type SourceConfig = {
  /** Himalayas: pages of 20 fetched on the first run (default 15). */
  maxPages?: number;
  /** WeWorkRemotely: category slugs, e.g. `remote-programming-jobs`. */
  categories?: string[];
  /** Jobicy: `industry` slug (default `dev`) and page size (default 50). */
  industry?: string;
  count?: number;
  tags?: string[];
};

export type SourceFetchOptions = {
  fetchImpl?: typeof fetch;
  config?: SourceConfig;
  /** `job_sources.last_cursor` from the previous run. */
  cursor?: string | null;
  /** Aborts the requests when the radar run is cancelled. */
  signal?: AbortSignal;
};

export type SourceFetchResult = {
  jobs: SourceJob[];
  /** New cursor to store when the run succeeds. */
  cursor?: string | null;
};

export type SourceFetcher = (options?: SourceFetchOptions) => Promise<SourceFetchResult>;

/** A `job_sources` row prepared for a run. */
export type MonitoringSource = {
  id: number;
  kind: SourceKind;
  name: string;
  config: SourceConfig;
  cursor: string | null;
};

/** Label shown in the progress panel where a company name would be. */
export function sourceStepLabel(source: Pick<MonitoringSource, "name">) {
  return `Fonte: ${source.name}`;
}
