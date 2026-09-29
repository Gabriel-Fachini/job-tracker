"use server";

import { revalidatePath } from "next/cache";

import { MAX_IMPORT_BYTES } from "@/lib/glassdoor/auth";
import {
  importGlassdoorPayload,
  type GlassdoorCompanyImportResult,
} from "@/lib/glassdoor/import";
import { GlassdoorPayloadError } from "@/lib/glassdoor/payload";

export type GlassdoorFileImportResult =
  | {
      ok: true;
      companies: GlassdoorCompanyImportResult[];
      errors: Array<{ glassdoorId: number | null; error: string }>;
    }
  | { ok: false; error: string };

/**
 * Manual upload of a `glassdoor-*.json` file produced by the collector skill.
 * Same import as `POST /api/glassdoor/import`, without the token: it is only
 * reachable from the app's own UI (same origin).
 */
export async function importGlassdoorFile(
  formData: FormData,
): Promise<GlassdoorFileImportResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Escolha um arquivo JSON do Glassdoor." };
  }

  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: "Arquivo maior que o limite de 10 MB." };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }

  try {
    const result = importGlassdoorPayload(payload);

    revalidatePath("/companies");
    for (const company of result.companies) {
      revalidatePath(`/companies/${company.companyId}`);
    }

    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof GlassdoorPayloadError) {
      return { ok: false, error: error.message };
    }

    console.error("glassdoor file import failed", error);
    return { ok: false, error: "Falha ao importar o arquivo." };
  }
}
