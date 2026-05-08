import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  ApplicationResumeUploadError,
  readStoredApplicationResume,
  saveApplicationResume,
} from "@/lib/applications/resume-upload";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const applicationId = await readApplicationId(context);

  if (applicationId === null) {
    return NextResponse.json(
      { ok: false, error: "O identificador da candidatura é inválido." },
      { status: 400 },
    );
  }

  const application = db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!application) {
    return NextResponse.json(
      { ok: false, error: "A candidatura não foi encontrada." },
      { status: 404 },
    );
  }

  try {
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "").trim();
    const now = new Date();

    if (mode === "empty") {
      db.update(applications)
        .set({
          usedResumeStatus: "empty",
          usedResumePath: null,
          usedResumeOriginalFilename: null,
          updatedAt: now,
        })
        .where(eq(applications.id, applicationId))
        .run();

      revalidatePath("/applications");

      return NextResponse.json({
        ok: true,
        resumeStatus: "empty",
      });
    }

    if (mode === "unknown") {
      db.update(applications)
        .set({
          usedResumeStatus: "unknown",
          usedResumePath: null,
          usedResumeOriginalFilename: null,
          updatedAt: now,
        })
        .where(eq(applications.id, applicationId))
        .run();

      revalidatePath("/applications");

      return NextResponse.json({
        ok: true,
        resumeStatus: "unknown",
      });
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Envie um arquivo PDF ou marque a candidatura como sem currículo." },
        { status: 400 },
      );
    }

    const savedFile = await saveApplicationResume(file, applicationId);

    db.update(applications)
      .set({
        usedResumeStatus: "uploaded",
        usedResumePath: savedFile.relativePath,
        usedResumeOriginalFilename: savedFile.originalFilename,
        updatedAt: now,
      })
      .where(eq(applications.id, applicationId))
      .run();

    revalidatePath("/applications");

    return NextResponse.json({
      ok: true,
      resumeStatus: "uploaded",
      resumePath: savedFile.relativePath,
      originalFilename: savedFile.originalFilename,
      size: savedFile.size,
    });
  } catch (error) {
    if (error instanceof ApplicationResumeUploadError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Falha ao salvar o currículo da candidatura." },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const applicationId = await readApplicationId(context);

  if (applicationId === null) {
    return NextResponse.json(
      { ok: false, error: "O identificador da candidatura é inválido." },
      { status: 400 },
    );
  }

  const application = db
    .select({
      id: applications.id,
      usedResumeStatus: applications.usedResumeStatus,
      usedResumePath: applications.usedResumePath,
      usedResumeOriginalFilename: applications.usedResumeOriginalFilename,
    })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!application) {
    return NextResponse.json(
      { ok: false, error: "A candidatura não foi encontrada." },
      { status: 404 },
    );
  }

  if (
    application.usedResumeStatus !== "uploaded" ||
    !application.usedResumePath ||
    !application.usedResumeOriginalFilename
  ) {
    return NextResponse.json(
      { ok: false, error: "Nenhum currículo em PDF foi registrado para esta candidatura." },
      { status: 404 },
    );
  }

  try {
    const file = await readStoredApplicationResume(application.usedResumePath);

    return new NextResponse(file.bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${application.usedResumeOriginalFilename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao abrir o currículo salvo para esta candidatura.",
      },
      { status: 500 },
    );
  }
}

async function readApplicationId(
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const applicationId = Number(id);

  return Number.isInteger(applicationId) ? applicationId : null;
}
