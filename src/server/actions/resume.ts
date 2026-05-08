"use server";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applications, jobs, companies } from "@/lib/db/schema";
import { getProfileSnapshot } from "@/lib/profile/queries";
import { generateResumeSelection } from "@/lib/ai/resume-generation";
import { buildResumeData } from "@/lib/latex/profile-adapter";
import { renderResumeTex } from "@/lib/latex/render";

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function todayYearMonthHHMM(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 7);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${date}_${hh}-${mm}`;
}

export async function generateResume(
  applicationId: number,
): Promise<{ success: true; filePath: string } | { success: false; error: string }> {
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

    const aiSelection = await generateResumeSelection(profile, {
      title: row.jobTitle,
      description: row.jobDescription,
      company: row.companyName,
    });
    console.log("[resume] aiSelection:", JSON.stringify(aiSelection, null, 2));

    const resumeData = buildResumeData(profile, aiSelection);
    const tex = renderResumeTex(resumeData);

    const outDir = path.resolve("uploads/resumes/generated");
    fs.mkdirSync(outDir, { recursive: true });

    const slug = sanitizeFilename(row.companyName);
    const yearMonthHHMM = todayYearMonthHHMM();
    const basename = `Gabriel_Fachini_${slug}_${yearMonthHHMM}`;
    const texPath = path.join(outDir, `${basename}.tex`);
    fs.writeFileSync(texPath, tex, "utf8");

    execFileSync("tectonic", [texPath, "--outdir", outDir], {
      stdio: "pipe",
      timeout: 60_000,
    });

    const pdfPath = path.join(outDir, `${basename}.pdf`);

    db.update(applications)
      .set({ generatedResumePath: pdfPath })
      .where(eq(applications.id, applicationId))
      .run();

    return { success: true, filePath: pdfPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Falha ao gerar currículo: ${message}` };
  }
}

export async function openResumeInFinder(filePath: string): Promise<void> {
  execFileSync("open", ["-R", filePath], { timeout: 5_000 });
}
