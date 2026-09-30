import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applications, companies, jobLeads, jobs } from "@/lib/db/schema";
import type { GenerateResumeFileResult } from "@/lib/resume/generate";
import { getProfileSnapshot } from "@/lib/profile/queries";
import { getSearchPreferences } from "@/lib/search-preferences-queries";
import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { SearchPreferences } from "@/lib/search-preferences";

import { buildKitAnswers } from "./answers";
import { generateCoverLetter, generateFreeTextDraft, type CoverLetterInput } from "./cover-letter";
import { mapFieldsHeuristically, type FieldMapping } from "./field-mapping";
import { classifyFieldsWithModel } from "./field-mapping-model";
import { extractApplicationForm } from "./form-sources";
import { computeKitStatus, readKit, upsertKit, type KitView } from "./kit-store";
import type { FormExtraction, FormField } from "./types";

export const MAX_FREE_TEXT_DRAFTS = 5;

export type KitDependencies = {
  generateResume?: (applicationId: number) => Promise<GenerateResumeFileResult>;
  generateCoverLetter?: typeof generateCoverLetter;
  generateFreeTextDraft?: typeof generateFreeTextDraft;
  extractForm?: (applyUrl: string, boardUrl: string | null) => Promise<FormExtraction>;
  classifyFields?: (fields: FormField[]) => Promise<Record<string, FieldMapping>>;
  loadProfile?: () => Promise<ProfileSnapshot | null>;
  loadPreferences?: () => SearchPreferences | null;
};

export type PrepareKitResult =
  | { ok: true; kit: KitView; warnings: string[] }
  | { ok: false; error: "not-found" | "no-profile" | "no-description" };

type Source = {
  jobTitle: string;
  jobDescription: string | null;
  jobSourceUrl: string | null;
  companyName: string;
  boardUrl: string | null;
  leadApplyUrl: string | null;
  leadSourceUrl: string | null;
};

function loadSource(applicationId: number): Source | null {
  const row = db
    .select({
      jobTitle: jobs.title,
      jobDescription: jobs.description,
      jobSourceUrl: jobs.sourceUrl,
      companyName: companies.name,
      boardUrl: companies.jobsBoardUrl,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(applications.id, applicationId))
    .get();

  if (!row) {
    return null;
  }

  const lead = db
    .select({ applyUrl: jobLeads.applyUrl, sourceUrl: jobLeads.sourceUrl })
    .from(jobLeads)
    .where(and(eq(jobLeads.promotedToApplicationId, applicationId)))
    .get();

  return { ...row, leadApplyUrl: lead?.applyUrl ?? null, leadSourceUrl: lead?.sourceUrl ?? null };
}

/** The page the kit fills: the lead's direct apply link, else its posting, else the job's own URL. */
export function resolveApplyUrl(source: Pick<Source, "leadApplyUrl" | "leadSourceUrl" | "jobSourceUrl">): string | null {
  return source.leadApplyUrl ?? source.leadSourceUrl ?? source.jobSourceUrl ?? null;
}

/**
 * Prepares (or re-prepares) the assisted-application kit: English resume, cover
 * letter, form fields and mapped answers. Each part fails on its own into a
 * warning, so a blocked form or a missing `tectonic` still leaves a usable kit.
 * Nothing is ever submitted.
 */
export async function prepareApplicationKit(
  applicationId: number,
  deps: KitDependencies = {},
): Promise<PrepareKitResult> {
  const source = loadSource(applicationId);

  if (!source) {
    return { ok: false, error: "not-found" };
  }

  const profile = await (deps.loadProfile ?? getProfileSnapshot)();

  if (!profile) {
    return { ok: false, error: "no-profile" };
  }

  if (!source.jobDescription?.trim()) {
    return { ok: false, error: "no-description" };
  }

  const preferences = (deps.loadPreferences ?? getSearchPreferences)();
  const applyUrl = resolveApplyUrl(source);
  const warnings: string[] = [];
  const existing = readKit(applicationId);
  const job = { title: source.jobTitle, company: source.companyName, description: source.jobDescription };
  const letterInput: CoverLetterInput = { profile, job };

  // 1. English resume.
  let resumePath: string | null = existing?.resumePath ?? null;

  try {
    const generate = deps.generateResume ?? (async (id: number) => (await import("@/lib/resume/generate")).generateResumeFile(id, { language: "en" }));
    const result = await generate(applicationId);

    if (result.success) {
      resumePath = result.filePath;
    } else {
      warnings.push(`Currículo em inglês: ${result.error}`);
    }
  } catch (error) {
    warnings.push(`Currículo em inglês: ${errorMessage(error)}`);
  }

  // 2. Cover letter.
  let coverLetter: string | null = existing?.coverLetter ?? null;

  try {
    coverLetter = await (deps.generateCoverLetter ?? generateCoverLetter)(letterInput);
  } catch (error) {
    warnings.push(`Cover letter: ${errorMessage(error)}`);
  }

  // 3. Form fields.
  let fields: FormField[] = existing?.fields ?? [];

  if (!applyUrl) {
    warnings.push("Formulário: esta vaga não tem link de candidatura.");
  } else {
    try {
      const extractForm =
        deps.extractForm ??
        (async (url: string, boardUrl: string | null) => {
          const { extractFormWithBrowser } = await import("./browser-form");

          return extractApplicationForm(url, { boardUrl, browserExtract: extractFormWithBrowser });
        });
      const extraction = await extractForm(applyUrl, source.boardUrl);

      if (extraction.blocked) {
        warnings.push(
          extraction.blocked === "captcha"
            ? "Formulário: a página pede verificação anti-robô (CAPTCHA). Os campos não foram lidos; preencha à mão."
            : "Formulário: a página exige login. Os campos não foram lidos; preencha à mão.",
        );
      } else if (extraction.fields.length === 0) {
        warnings.push("Formulário: nenhum campo encontrado. Abra o link e preencha à mão.");
      } else {
        fields = extraction.fields;
      }
    } catch (error) {
      warnings.push(`Formulário: ${errorMessage(error)}`);
    }
  }

  // 4. Mapping and answers.
  const { mapped, unresolved } = mapFieldsHeuristically(fields);
  const modelMapped = await (deps.classifyFields ?? ((unknownFields: FormField[]) => classifyFieldsWithModel(unknownFields)))(unresolved);
  const mappings = { ...mapped, ...modelMapped };

  const freeTextDrafts: Record<string, string> = {};
  const freeTextFields = fields.filter((field) => mappings[field.id]?.key === "free_text").slice(0, MAX_FREE_TEXT_DRAFTS);

  for (const field of freeTextFields) {
    try {
      freeTextDrafts[field.id] = await (deps.generateFreeTextDraft ?? generateFreeTextDraft)(field.label, letterInput);
    } catch (error) {
      warnings.push(`Rascunho para "${field.label.slice(0, 60)}": ${errorMessage(error)}`);
    }
  }

  const generated = buildKitAnswers({ fields, mappings, profile, preferences, coverLetter, hasResume: Boolean(resumePath), freeTextDrafts });
  // A re-prepare never overwrites what the user already typed.
  const answers = { ...generated };

  for (const [id, previous] of Object.entries(existing?.answers ?? {})) {
    if (previous.source === "manual" && answers[id]) {
      answers[id] = previous;
    }
  }

  const kit = upsertKit(applicationId, {
    applyUrl,
    resumePath,
    coverLetter,
    fields,
    answers,
    language: "en",
    status: computeKitStatus({ resumePath, coverLetter, fields, answers, status: existing?.status }),
  });

  return { ok: true, kit, warnings };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "erro desconhecido";
}
