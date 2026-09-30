import { fetchHimalayasJobs } from "./himalayas";
import { fetchHnWhoIsHiringJobs } from "./hn";
import { fetchJobicyJobs } from "./jobicy";
import { fetchRemoteOkJobs } from "./remoteok";
import type { SourceFetcher, SourceKind } from "./types";
import { fetchWeWorkRemotelyJobs } from "./weworkremotely";

export * from "./types";
export { defaultSources, getSourceAttribution } from "./catalog";

export const sourceFetchers: Record<SourceKind, SourceFetcher> = {
  himalayas: fetchHimalayasJobs,
  remoteok: fetchRemoteOkJobs,
  weworkremotely: fetchWeWorkRemotelyJobs,
  jobicy: fetchJobicyJobs,
  hn_whoishiring: fetchHnWhoIsHiringJobs,
};
