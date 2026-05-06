import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_UPLOADS_PATH = "./uploads";
const APPLICATION_RESUME_DIRECTORY = ["resumes", "applications"];
const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class ApplicationResumeUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationResumeUploadError";
  }
}

export function getUploadsRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.UPLOADS_PATH ?? DEFAULT_UPLOADS_PATH,
  );
}

export function getApplicationResumeDirectory() {
  return path.join(getUploadsRoot(), ...APPLICATION_RESUME_DIRECTORY);
}

export async function saveApplicationResume(
  file: File,
  applicationId: number,
) {
  validateResumeFile(file);

  const buffer = Buffer.from(await file.arrayBuffer());
  const directory = getApplicationResumeDirectory();
  const extension = getPdfExtension(file.name);
  const filename = `application-${applicationId}-resume-${Date.now()}${extension}`;
  const absolutePath = path.join(directory, filename);

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    absolutePath,
    relativePath: toProjectRelativePath(absolutePath),
    originalFilename: file.name,
    size: buffer.byteLength,
  };
}

export async function readStoredApplicationResume(relativePath: string) {
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    relativePath,
  );

  return {
    absolutePath,
    bytes: await readFile(absolutePath),
  };
}

function validateResumeFile(file: File) {
  if (file.size === 0) {
    throw new ApplicationResumeUploadError("O PDF enviado está vazio.");
  }

  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new ApplicationResumeUploadError("O PDF enviado ultrapassa o limite de 10 MB.");
  }

  const extension = getPdfExtension(file.name);
  const looksLikePdf =
    extension === ".pdf" || file.type === "application/pdf";

  if (!looksLikePdf) {
    throw new ApplicationResumeUploadError(
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
