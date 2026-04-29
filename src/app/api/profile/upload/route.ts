import { NextResponse } from "next/server";

import {
  extractTextFromPdfBuffer,
  ProfileUploadError,
  saveMasterResume,
} from "@/lib/profile/upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Um arquivo PDF é obrigatório no campo de upload.",
        },
        { status: 400 },
      );
    }

    const savedFile = await saveMasterResume(uploadedFile);
    const rawText = await extractTextFromPdfBuffer(savedFile.buffer);

    return NextResponse.json({
      ok: true,
      rawText,
      masterResumePath: savedFile.relativePath,
      originalFilename: savedFile.originalFilename,
      size: savedFile.size,
    });
  } catch (error) {
    if (error instanceof ProfileUploadError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "O upload do perfil falhou por um motivo desconhecido.",
      },
      { status: 500 },
    );
  }
}
