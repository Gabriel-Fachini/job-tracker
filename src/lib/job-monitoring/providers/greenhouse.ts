import type { DiscoveredLink } from "../types";

type GreenhouseJobsResponse = {
  jobs: Array<{
    id: number;
    title: string;
    updated_at: string;
    content: string;
    location?: { name: string };
    absolute_url: string;
    departments?: Array<{ name: string }>;
    offices?: Array<{ name: string; location: string }>;
  }>;
  meta?: { total: number };
};

type GreenhousePrefetchedData = {
  title: string;
  descriptionHtml: string;
  descriptionMarkdown?: string;
  locationText?: string;
  departments?: string[];
  offices?: string[];
  updatedAt?: string;
  externalId: string;
};

export async function fetchGreenhouseJobs(
  boardToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscoveredLink[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;

  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Greenhouse board token inválido ou inacessível: ${boardToken}`,
        );
      }
      throw new Error(
        `Erro ao acessar Greenhouse API: ${response.status}`,
      );
    }

    const data: GreenhouseJobsResponse = await response.json();

    if (!data.jobs || !Array.isArray(data.jobs)) {
      return [];
    }

    const links: DiscoveredLink[] = data.jobs.map((job) => {
      const prefetchedData: GreenhousePrefetchedData = {
        title: job.title,
        descriptionHtml: job.content || "",
        locationText: formatLocations(job.location, job.offices),
        departments: job.departments?.map((d) => d.name),
        offices: job.offices?.map((o) => o.name),
        updatedAt: job.updated_at,
        externalId: String(job.id),
      };

      return {
        url: job.absolute_url,
        text: job.title,
        prefetched: prefetchedData,
      };
    });

    return links;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    throw new Error(`Falha ao buscar vagas Greenhouse: ${message}`);
  }
}

function formatLocations(
  location: { name: string } | undefined,
  offices: Array<{ name: string; location: string }> | undefined,
): string | undefined {
  const parts: string[] = [];

  if (location?.name) {
    parts.push(location.name);
  }

  if (offices && offices.length > 0) {
    const officeNames = offices.map((o) => o.name).filter(Boolean);
    if (officeNames.length > 0 && !parts.includes(officeNames[0])) {
      parts.push(...officeNames);
    }
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function extractGreenhouseBoardToken(jobsBoardUrl: string): string | null {
  try {
    const url = new URL(jobsBoardUrl);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (
      (url.hostname.includes("boards.greenhouse.io") ||
        url.hostname.includes("job-boards.greenhouse.io")) &&
      pathSegments.length > 0
    ) {
      return pathSegments[0];
    }

    return null;
  } catch {
    return null;
  }
}
