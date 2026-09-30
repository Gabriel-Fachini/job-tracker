import { NextResponse } from "next/server";

import { readKit } from "@/lib/apply/kit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JSON of an application's kit for the local fill script (`npm run apply:fill`).
 * It carries the personal answers (name, e-mail...) of the single user of this
 * app, like the rest of the app: protection is the network (Tailscale). No file
 * system paths are exposed; the resume is a URL of this app.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const applicationId = Number(id);

  if (!Number.isInteger(applicationId)) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  const kit = readKit(applicationId);

  if (!kit) {
    return NextResponse.json({ ok: false, error: "Kit ainda não preparado para esta candidatura." }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      applicationId,
      applyUrl: kit.applyUrl,
      status: kit.status,
      language: kit.language,
      resumeUrl: kit.resumePath ? `/api/applications/${applicationId}/kit/resume` : null,
      coverLetter: kit.coverLetter,
      fields: kit.fields,
      answers: kit.answers,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
