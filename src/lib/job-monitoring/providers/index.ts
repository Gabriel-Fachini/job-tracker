import type { MonitoringCompany, DiscoveredLink } from "../types";
import {
  fetchGreenhouseJobs,
  extractGreenhouseBoardToken,
} from "./greenhouse";
import { fetchInhireJobs } from "./inhire";
import { fetchGupyJobs } from "./gupy";
import { extractAshbyOrg, fetchAshbyJobs } from "./ashby";
import { fetchLeverJobs, parseLeverBoardUrl } from "./lever";

export type AtsProvider =
  | "greenhouse"
  | "gupy"
  | "inhire"
  | "ashby"
  | "lever"
  | "generic"
  | "auto";

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

  if (extractAshbyOrg(url)) {
    return "ashby";
  }

  if (parseLeverBoardUrl(url)) {
    return "lever";
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

  if (resolvedProvider === "inhire") {
    return fetchInhireJobs(company.jobsBoardUrl);
  }

  if (resolvedProvider === "gupy") {
    return fetchGupyJobs(company.jobsBoardUrl);
  }

  if (resolvedProvider === "ashby") {
    return extractAshbyOrg(company.jobsBoardUrl)
      ? fetchAshbyJobs(company.jobsBoardUrl, fetchImpl)
      : null;
  }

  if (resolvedProvider === "lever") {
    return parseLeverBoardUrl(company.jobsBoardUrl)
      ? fetchLeverJobs(company.jobsBoardUrl, fetchImpl)
      : null;
  }

  return null;
}
