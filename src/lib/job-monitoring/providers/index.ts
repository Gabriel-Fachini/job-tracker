import type { MonitoringCompany, DiscoveredLink } from "../types";
import {
  fetchGreenhouseJobs,
  extractGreenhouseBoardToken,
} from "./greenhouse";

export type AtsProvider = "greenhouse" | "gupy" | "inhire" | "generic" | "auto";

export async function resolveAtsProvider(
  company: MonitoringCompany,
  atsProvider?: string | null,
): Promise<AtsProvider> {
  const provider = (atsProvider || "auto") as AtsProvider;

  if (provider !== "auto") {
    return provider;
  }

  const url = company.jobsBoardUrl;

  if (
    url.includes("boards.greenhouse.io") ||
    url.includes("job-boards.greenhouse.io")
  ) {
    return "greenhouse";
  }

  if (url.includes(".gupy.io")) {
    return "gupy";
  }

  if (url.includes(".inhire.app")) {
    return "inhire";
  }

  return "generic";
}

export async function discoverViaProvider(
  company: MonitoringCompany,
  resolvedProvider: AtsProvider,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<DiscoveredLink[] | null> {
  const fetchImpl = options.fetchImpl ?? fetch;

  if (resolvedProvider === "greenhouse") {
    const boardToken = extractGreenhouseBoardToken(company.jobsBoardUrl);

    if (!boardToken) {
      return null;
    }

    return fetchGreenhouseJobs(boardToken, fetchImpl);
  }

  return null;
}
