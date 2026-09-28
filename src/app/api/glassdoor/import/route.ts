import { revalidatePath } from "next/cache";

import {
  authorizeGlassdoorRequest,
  BodyTooLargeError,
  jsonError,
  readBodyText,
} from "@/lib/glassdoor/auth";
import { importGlassdoorPayload } from "@/lib/glassdoor/import";
import { GlassdoorPayloadError } from "@/lib/glassdoor/payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the glassdoor-collect skill with `Authorization: Bearer <GLASSDOOR_IMPORT_TOKEN>`.
export async function POST(request: Request) {
  const denied = authorizeGlassdoorRequest(request);

  if (denied) {
    return denied;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(await readBodyText(request));
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return jsonError(413, error.message);
    }

    return jsonError(400, "Corpo não é um JSON válido.");
  }

  try {
    const result = importGlassdoorPayload(payload);

    revalidatePath("/companies");
    for (const company of result.companies) {
      revalidatePath(`/companies/${company.companyId}`);
    }

    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GlassdoorPayloadError) {
      return jsonError(422, error.message);
    }

    console.error("glassdoor import failed", error);
    return jsonError(500, "Falha ao importar.");
  }
}
