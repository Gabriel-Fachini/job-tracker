import { htmlToMarkdown } from "../extraction";
import type { ExtractedJobDetail } from "../types";
import type { SourceJob } from "./types";

const number = new Intl.NumberFormat("en-US");

/** `USD 5,000-7,000 / month`, the same shape the ATS providers produce. */
export function formatSourceSalary(salary: SourceJob["salary"]): string | null {
  if (!salary || (salary.min === undefined && salary.max === undefined)) {
    return null;
  }

  const amount =
    salary.min !== undefined && salary.max !== undefined && salary.min !== salary.max
      ? `${number.format(salary.min)}-${number.format(salary.max)}`
      : number.format((salary.min ?? salary.max) as number);

  return `${salary.currency ? `${salary.currency} ` : ""}${amount}${salary.period ? ` / ${salary.period}` : ""}`;
}

/** Maps free-form feed levels to the app's seniority values, or null. */
export function normalizeSourceSeniority(value: string | null | undefined): string | null {
  const text = value?.toLowerCase() ?? "";

  if (!text) return null;
  if (/\b(intern|internship|trainee)\b/.test(text)) return "intern";
  if (/\b(entry|junior|jr|associate)\b/.test(text)) return "junior";
  if (/\b(mid|middle|intermediate|pleno)\b/.test(text)) return "mid";
  if (/\b(senior|sr)\b/.test(text)) return "senior";
  if (/\b(staff|principal)\b/.test(text)) return "staff";
  if (/\b(lead|manager|director|head)\b/.test(text)) return "lead";

  return null;
}

/** The feed job as the extraction result the classifier and persistence expect. */
export function sourceJobToDetail(job: SourceJob): ExtractedJobDetail {
  const description = job.descriptionHtml
    ? htmlToMarkdown(job.descriptionHtml)
    : (job.descriptionText ?? null);

  return {
    title: job.title,
    description: description || null,
    sourceUrl: job.url,
    sourceName: job.sourceKind,
    // Every aggregated feed lists remote roles.
    workModel: "remote",
    seniority: normalizeSourceSeniority(job.seniority),
    locationText: job.locationText ?? null,
    salaryText: formatSourceSalary(job.salary),
  };
}
