"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import type { ResumeLanguage } from "@/lib/latex/types";
import { generateResumeFile } from "@/lib/resume/generate";

/**
 * Generates the tailored resume for an application. The Portuguese flow (default)
 * stores the PDF path in `applications.generated_resume_path`. `{ language: "en" }`
 * only returns the file: the assisted-application kit keeps the English PDF
 * as its own `resume_path`, so the Portuguese one is not overwritten.
 */
export async function generateResume(
  applicationId: number,
  options: { language?: ResumeLanguage } = {},
): Promise<{ success: true; filePath: string } | { success: false; error: string }> {
  const language = options.language === "en" ? "en" : "pt";
  const result = await generateResumeFile(applicationId, { language });

  if (result.success && language === "pt") {
    db.update(applications)
      .set({ generatedResumePath: result.filePath })
      .where(eq(applications.id, applicationId))
      .run();
  }

  return result;
}
