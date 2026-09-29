import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

import { generateResumeSelection } from "@/lib/ai/resume-generation";
import { getUploadsRoot } from "@/lib/applications/resume-upload";
import { db } from "@/lib/db";
import { applications, companies, jobs } from "@/lib/db/schema";
import { buildResumeData } from "@/lib/latex/profile-adapter";
import { renderResumeTex } from "@/lib/latex/render";
import type { ResumeLanguage } from "@/lib/latex/types";
import { getProfileSnapshot } from "@/lib/profile/queries";

export function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function timestamp(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 7);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return `${date}_${hh}-${mm}`;
}

export type GenerateResumeFileResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

/**
 * Selects content with the generation engine, renders the LaTeX template and
 * compiles it with `tectonic`. Writes `<UPLOADS_PATH>/resumes/generated/<Name>_<Company>_<YYYY-MM>_<HH-MM>[_en].pdf`
 * (+ `.tex`). It does not touch the application row: callers decide where the path goes.
 */
export async function generateResumeFile(
  applicationId: number,
  options: { language?: ResumeLanguage } = {},
): Promise<GenerateResumeFileResult> {
  const language = options.language ?? "pt";

  try {
    const row = db
      .select({
        appId: applications.id,
        jobTitle: jobs.title,
        jobDescription: jobs.description,
        companyName: companies.name,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(applications.id, applicationId))
      .get();

    if (!row) {
      return { success: false, error: "Candidatura não encontrada." };
    }

    const profile = await getProfileSnapshot();
    if (!profile) {
      return { success: false, error: "Perfil não encontrado. Configure seu perfil primeiro." };
    }

    if (!row.jobDescription) {
      return { success: false, error: "A vaga não possui descrição. Adicione uma descrição para gerar o currículo." };
    }

    const aiSelection = await generateResumeSelection(
      profile,
      { title: row.jobTitle, description: row.jobDescription, company: row.companyName },
      { language },
    );
    console.log("[resume] aiSelection:", JSON.stringify(aiSelection, null, 2));

    const resumeData = buildResumeData(profile, aiSelection, { language });
    const tex = renderResumeTex(resumeData);

    const outDir = path.join(getUploadsRoot(), "resumes", "generated");
    fs.mkdirSync(outDir, { recursive: true });

    const authorSlug = sanitizeFilename(profile.fullName) || "Resume";
    const basename = `${authorSlug}_${sanitizeFilename(row.companyName)}_${timestamp()}${language === "en" ? "_en" : ""}`;
    const texPath = path.join(outDir, `${basename}.tex`);
    fs.writeFileSync(texPath, tex, "utf8");

    try {
      execFileSync("tectonic", [texPath, "--outdir", outDir], { stdio: "pipe", timeout: 60_000 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, error: "O binário `tectonic` não foi encontrado no PATH. Instale-o para compilar o currículo." };
      }

      throw error;
    }

    return { success: true, filePath: path.join(outDir, `${basename}.pdf`) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return { success: false, error: `Falha ao gerar currículo: ${message}` };
  }
}
