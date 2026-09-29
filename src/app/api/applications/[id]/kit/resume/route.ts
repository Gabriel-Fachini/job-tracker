import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { getUploadsRoot } from "@/lib/applications/resume-upload";
import { readKit } from "@/lib/apply/kit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The English resume of the kit, as a PDF. Only files under `<UPLOADS_PATH>/resumes` are served. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const applicationId = Number(id);

  if (!Number.isInteger(applicationId)) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  const kit = readKit(applicationId);

  if (!kit?.resumePath) {
    return NextResponse.json({ ok: false, error: "Este kit não tem currículo em inglês." }, { status: 404 });
  }

  const allowedRoot = path.join(getUploadsRoot(), "resumes") + path.sep;
  const resolved = path.resolve(kit.resumePath);

  if (!resolved.startsWith(allowedRoot)) {
    return NextResponse.json({ ok: false, error: "Caminho de currículo inválido." }, { status: 400 });
  }

  try {
    const bytes = fs.readFileSync(resolved);
    const filename = path.basename(resolved);
    const download = new URL(request.url).searchParams.get("download") === "1";

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao ler o arquivo do currículo." }, { status: 500 });
  }
}
