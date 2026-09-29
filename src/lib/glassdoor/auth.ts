import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Bearer-token gate for the machine endpoints (`/api/glassdoor/*`).
 * Fails closed: without `GLASSDOOR_IMPORT_TOKEN` configured, nothing gets in.
 * Returns the error `Response` to send, or `null` when the request is allowed.
 */
export function authorizeGlassdoorRequest(request: Request): Response | null {
  const expected = process.env.GLASSDOOR_IMPORT_TOKEN;

  if (!expected) {
    return jsonError(503, "GLASSDOOR_IMPORT_TOKEN não configurado no servidor.");
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match || !tokensMatch(match[1].trim(), expected)) {
    return jsonError(401, "Token inválido.");
  }

  return null;
}

// Hashing first gives equal-length buffers, so the comparison never leaks the length.
function tokensMatch(received: string, expected: string) {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function jsonError(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super("Corpo maior que o limite de 10 MB.");
    this.name = "BodyTooLargeError";
  }
}

/** Reads the request body as text, aborting once it exceeds `limit` bytes. */
export async function readBodyText(request: Request, limit = MAX_IMPORT_BYTES) {
  const declared = Number(request.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > limit) {
    throw new BodyTooLargeError();
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > limit) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}
