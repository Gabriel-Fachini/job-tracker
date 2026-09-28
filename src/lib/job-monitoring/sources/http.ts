export const SOURCE_REQUEST_TIMEOUT_MS = 20_000;

/** Identifies a personal, low-volume use of the public feeds. */
export const SOURCE_USER_AGENT =
  "JobTrackerRadar/1.0 (personal job search; low volume; +https://local.job-tracker)";

async function request(
  url: string,
  fetchImpl: typeof fetch,
  accept: string,
  signal?: AbortSignal,
): Promise<Response> {
  const timeout = AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS);
  const response = await fetchImpl(url, {
    headers: { "user-agent": SOURCE_USER_AGENT, accept },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em ${new URL(url).hostname}`);
  }

  return response;
}

export async function getJson<T>(
  url: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<T> {
  const response = await request(url, fetchImpl, "application/json", signal);

  return (await response.json()) as T;
}

export async function getText(
  url: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<string> {
  const response = await request(
    url,
    fetchImpl,
    "application/rss+xml, application/xml, text/xml, */*;q=0.5",
    signal,
  );

  return response.text();
}

/** Positive finite number or undefined (feeds use 0 and null for "unknown"). */
export function positiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;

  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
}

export function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
