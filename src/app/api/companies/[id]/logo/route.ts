import { readCompanyLogo } from "@/lib/company-logos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const companyId = Number(id);
  const logo =
    Number.isInteger(companyId) && companyId > 0
      ? await readCompanyLogo(companyId)
      : null;

  if (!logo) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // `?v=<content hash>` never changes content. The bare URL is the first
  // lookup, and a stale `v` must not pin old bytes in the browser cache.
  const isCurrentVersion = new URL(request.url).searchParams.get("v") === logo.version;

  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": isCurrentVersion
        ? "private, max-age=31536000, immutable"
        : "private, no-cache",
      // Third-party bytes: an SVG opened directly must not run scripts here.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
