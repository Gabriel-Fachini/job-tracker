import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_UPLOADS_PATH = "./uploads";
const MASTER_RESUME_DIRECTORY = ["resumes", "master"];
const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class ProfileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileUploadError";
  }
}

export function getUploadsRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.UPLOADS_PATH ?? DEFAULT_UPLOADS_PATH,
  );
}

export function getMasterResumeDirectory() {
  return path.join(getUploadsRoot(), ...MASTER_RESUME_DIRECTORY);
}

export async function saveMasterResume(file: File) {
  validateResumeFile(file);

  const buffer = Buffer.from(await file.arrayBuffer());
  const directory = getMasterResumeDirectory();
  const extension = getPdfExtension(file.name);
  const filename = `master-resume-${Date.now()}${extension}`;
  const absolutePath = path.join(directory, filename);

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    buffer,
    absolutePath,
    relativePath: toProjectRelativePath(absolutePath),
    originalFilename: file.name,
    size: buffer.byteLength,
  };
}

export async function extractTextFromPdfBuffer(buffer: Buffer) {
  try {
    const { getDocument, VerbosityLevel } = await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

    const document = await getDocument({
      data: new Uint8Array(buffer),
      verbosity: VerbosityLevel.ERRORS,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }

      page.cleanup();
    }

    await document.destroy();

    const text = pages.join("\n\n").trim();

    if (!text) {
      throw new ProfileUploadError(
        "O PDF enviado não contém texto extraível.",
      );
    }

    return text;
  } catch (error) {
    if (error instanceof ProfileUploadError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ProfileUploadError(
        `Falha ao extrair texto do PDF: ${error.message}`,
      );
    }

    throw new ProfileUploadError(
      "Falha ao extrair texto do PDF por um motivo desconhecido.",
    );
  }
}

function validateResumeFile(file: File) {
  if (file.size === 0) {
    throw new ProfileUploadError("O PDF enviado está vazio.");
  }

  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new ProfileUploadError("O PDF enviado ultrapassa o limite de 10 MB.");
  }

  const extension = getPdfExtension(file.name);
  const looksLikePdf =
    extension === ".pdf" || file.type === "application/pdf";

  if (!looksLikePdf) {
    throw new ProfileUploadError(
      "Apenas currículos em PDF são suportados neste fluxo.",
    );
  }
}

function getPdfExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return extension === ".pdf" ? extension : ".pdf";
}

function toProjectRelativePath(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath);
}
