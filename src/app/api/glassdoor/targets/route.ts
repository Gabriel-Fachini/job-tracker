import { authorizeGlassdoorRequest, jsonError } from "@/lib/glassdoor/auth";
import { getGlassdoorTargets } from "@/lib/glassdoor/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `?glassdoorId=<id>&name=<nome>` (both optional). Without params: every eligible company.
export async function GET(request: Request) {
  const denied = authorizeGlassdoorRequest(request);

  if (denied) {
    return denied;
  }

  const params = new URL(request.url).searchParams;
  const rawId = params.get("glassdoorId");
  const glassdoorId = rawId ? Number(rawId) : null;

  if (rawId && (!Number.isSafeInteger(glassdoorId) || (glassdoorId ?? 0) <= 0)) {
    return jsonError(400, "glassdoorId deve ser um inteiro positivo.");
  }

  const targets = getGlassdoorTargets({ glassdoorId, name: params.get("name") });

  return Response.json({ ok: true, targets }, { headers: { "Cache-Control": "no-store" } });
}
