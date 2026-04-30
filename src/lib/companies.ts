import {
  applicationStatusOptions,
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/applications";

export const companyStatusOptions = [
  { value: "monitoring", label: "Monitorando" },
  { value: "in_process", label: "Em processo" },
  { value: "discarded", label: "Descartada" },
  { value: "blacklist", label: "Blacklist" },
] as const;

export const companySizeOptions = [
  { value: "startup", label: "Startup" },
  { value: "small", label: "Pequena" },
  { value: "medium", label: "Média" },
  { value: "large", label: "Grande" },
  { value: "enterprise", label: "Enterprise" },
] as const;

export type CompanyStatus = (typeof companyStatusOptions)[number]["value"];
export type CompanySize = (typeof companySizeOptions)[number]["value"];

export const companyStatusLabelMap = Object.fromEntries(
  companyStatusOptions.map((option) => [option.value, option.label]),
) as Record<CompanyStatus, string>;

export const companySizeLabelMap = Object.fromEntries(
  companySizeOptions.map((option) => [option.value, option.label]),
) as Record<CompanySize, string>;

const activeApplicationStatuses = new Set<ApplicationStatus>([
  "applied",
  "in_process",
  "offer",
  "approved",
]);

export function isCompanyStatus(value: string): value is CompanyStatus {
  return companyStatusOptions.some((option) => option.value === value);
}

export function isCompanySize(value: string): value is CompanySize {
  return companySizeOptions.some((option) => option.value === value);
}

export function getCompanyStatusLabel(value: string | null | undefined) {
  return value && isCompanyStatus(value) ? companyStatusLabelMap[value] : null;
}

export function getCompanySizeLabel(value: string | null | undefined) {
  return value && isCompanySize(value) ? companySizeLabelMap[value] : null;
}

export function deriveCompanyStatus(
  rawStatuses: Array<string | null>,
  currentStatus: CompanyStatus | null | undefined,
): CompanyStatus {
  if (currentStatus === "blacklist") {
    return "blacklist";
  }

  const statuses = rawStatuses.filter((status): status is ApplicationStatus =>
    Boolean(status && isApplicationStatus(status)),
  );

  if (statuses.some((status) => activeApplicationStatuses.has(status))) {
    return "in_process";
  }

  if (statuses.includes("interesting")) {
    return "monitoring";
  }

  if (statuses.length > 0) {
    return "discarded";
  }

  return currentStatus && currentStatus !== "discarded"
    ? currentStatus
    : "monitoring";
}

export const companyAutomationStatusLabels = applicationStatusOptions
  .filter((option) => activeApplicationStatuses.has(option.value))
  .map((option) => option.label);
