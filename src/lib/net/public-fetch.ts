import { lookup as lookupCallback, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";

import { Agent, fetch, type Response } from "undici";

/**
 * Fetching URLs that come from third-party content (icons, careers pages...):
 * never reach this machine, the LAN, the tailnet or cloud metadata endpoints.
 * Redirects are followed by hand so every hop is checked. No `server-only`
 * import on purpose: CLI scripts (tsx) share this helper.
 */

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_REDIRECTS = 4;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)";

/** A definitive answer from the site; `transient` marks one worth retrying soon. */
export class PublicFetchError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "PublicFetchError";
  }
}

// fetch's own network and timeout errors, and DNS failures, count as transient.
export function isTransientFetchError(error: unknown) {
  return !(error instanceof PublicFetchError) || error.transient;
}

// Icon URLs come from third-party HTML: never let them reach this machine,
// the LAN, the tailnet or cloud metadata endpoints.
const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}

// No `::ffff:0:0/96` rule: BlockList already checks IPv4-mapped addresses
// against the IPv4 rules, and that rule would match every IPv4 address.
for (const [network, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

function isBlockedAddress(address: string) {
  return blockedAddresses.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

export async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PublicFetchError(`Unsupported protocol: ${url.protocol}`, false);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

  // Fails fast with a definitive error; publicOnlyAgent checks again at connect time.
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new PublicFetchError(`Blocked host: ${hostname}`, false);
  }
}

// The connection resolves the name again, so a DNS answer that changes after
// assertPublicUrl (DNS rebinding) is caught here, on the addresses the socket
// actually uses. IP literals skip lookup and are covered by assertPublicUrl.
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookupCallback(hostname, { ...options, all: true, verbatim: true }, (error, entries: LookupAddress[]) => {
    if (error) {
      callback(error, "", 0);
      return;
    }

    if (entries.length === 0 || entries.some((entry) => isBlockedAddress(entry.address))) {
      callback(new PublicFetchError(`Blocked host: ${hostname}`, false), "", 0);
      return;
    }

    if (options.all) {
      (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, entries);
    } else {
      callback(null, entries[0].address, entries[0].family);
    }
  });
};

const publicOnlyAgent = new Agent({ connect: { lookup: publicOnlyLookup } });

export type PublicFetchOptions = {
  accept: string;
  maxBytes: number;
  signal: AbortSignal;
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
};

export async function fetchPublicResource(target: URL, options: PublicFetchOptions) {
  let url = target;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  // Redirects are followed by hand so every hop goes through assertPublicUrl.
  for (let redirects = 0; ; redirects += 1) {
    await assertPublicUrl(url);

    const response = await fetch(url, {
      dispatcher: publicOnlyAgent,
      redirect: "manual",
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS)]),
      headers: {
        "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
        accept: options.accept,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    const location = response.headers.get("location");

    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();

      if (redirects >= maxRedirects) {
        throw new PublicFetchError("Too many redirects", false);
      }

      url = new URL(location, url);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new PublicFetchError(
        `HTTP ${response.status}`,
        response.status === 408 || response.status === 429 || response.status >= 500,
      );
    }

    return { url, bytes: await readLimitedBody(response, options.maxBytes) };
  }
}

async function readLimitedBody(response: Response, maxBytes: number) {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new PublicFetchError("Response too large", false);
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.byteLength;

    if (size > maxBytes) {
      await reader.cancel();
      throw new PublicFetchError("Response too large", false);
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
}
