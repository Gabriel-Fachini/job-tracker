export const jobStatusOptions = [
  { value: "interesting", label: "Interessante" },
  { value: "applying", label: "Aplicando" },
  { value: "applied", label: "Aplicada" },
  { value: "discarded", label: "Descartada" },
] as const;

export const workModelOptions = [
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Hibrido" },
  { value: "onsite", label: "Presencial" },
] as const;

export const seniorityOptions = [
  { value: "intern", label: "Estagio" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Pleno" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff" },
  { value: "lead", label: "Lead" },
] as const;

export const sourceNameOptions = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "gupy", label: "Gupy" },
  { value: "catho", label: "Catho" },
  { value: "company_site", label: "Site da empresa" },
  { value: "other", label: "Outro" },
] as const;

export type JobStatus = (typeof jobStatusOptions)[number]["value"];
export type WorkModel = (typeof workModelOptions)[number]["value"];
export type Seniority = (typeof seniorityOptions)[number]["value"];
export type SourceName = (typeof sourceNameOptions)[number]["value"];

export const jobStatusLabelMap = Object.fromEntries(
  jobStatusOptions.map((option) => [option.value, option.label]),
) as Record<JobStatus, string>;

export const workModelLabelMap = Object.fromEntries(
  workModelOptions.map((option) => [option.value, option.label]),
) as Record<WorkModel, string>;

export const seniorityLabelMap = Object.fromEntries(
  seniorityOptions.map((option) => [option.value, option.label]),
) as Record<Seniority, string>;

export const sourceNameLabelMap = Object.fromEntries(
  sourceNameOptions.map((option) => [option.value, option.label]),
) as Record<SourceName, string>;

export function isJobStatus(value: string): value is JobStatus {
  return jobStatusOptions.some((option) => option.value === value);
}

export function isWorkModel(value: string): value is WorkModel {
  return workModelOptions.some((option) => option.value === value);
}

export function isSeniority(value: string): value is Seniority {
  return seniorityOptions.some((option) => option.value === value);
}

export function isSourceName(value: string): value is SourceName {
  return sourceNameOptions.some((option) => option.value === value);
}

export function formatDate(date: Date | null | undefined) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function excerptMarkdown(markdown: string, maxLength = 220) {
  const normalized = markdown.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function getJobStatusLabel(value: string | null | undefined) {
  return value && isJobStatus(value) ? jobStatusLabelMap[value] : null;
}

export function getWorkModelLabel(value: string | null | undefined) {
  return value && isWorkModel(value) ? workModelLabelMap[value] : null;
}

export function getSeniorityLabel(value: string | null | undefined) {
  return value && isSeniority(value) ? seniorityLabelMap[value] : null;
}

export function getSourceNameLabel(value: string | null | undefined) {
  return value && isSourceName(value) ? sourceNameLabelMap[value] : null;
}
