import fs from "node:fs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const applicationId = Number(id);

  if (!Number.isInteger(applicationId)) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  const row = db
    .select({ generatedResumePath: applications.generatedResumePath })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!row?.generatedResumePath) {
    return NextResponse.json({ ok: false, error: "Nenhum currículo gerado para esta candidatura." }, { status: 404 });
  }

  try {
    const bytes = fs.readFileSync(row.generatedResumePath);
    const filename = row.generatedResumePath.split("/").at(-1) ?? "curriculo.pdf";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao ler o arquivo gerado." }, { status: 500 });
  }
}
