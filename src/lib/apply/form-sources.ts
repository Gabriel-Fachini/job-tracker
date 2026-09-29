import { detectBlockedPage, extractionFromHtml, isEeoText } from "./form-extract";
import type { FieldType, FormExtraction, FormField } from "./types";

const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
  accept: "application/json, text/html;q=0.9",
};

// ---- Greenhouse (public job-board API) ------------------------------------------

type GreenhouseQuestion = {
  label?: string;
  required?: boolean;
  description?: string | null;
  fields?: Array<{
    name: string;
    type: string;
    values?: Array<{ label?: string; value?: string | number }>;
  }>;
};

type GreenhouseJob = {
  questions?: GreenhouseQuestion[];
  location_questions?: GreenhouseQuestion[];
  compliance?: Array<{ questions?: GreenhouseQuestion[] }>;
  demographic_questions?: { questions?: GreenhouseQuestion[] } | null;
};

/** `boards.greenhouse.io/<token>/jobs/<id>` or `job-boards.greenhouse.io/...`. */
export function parseGreenhouseApplyUrl(url: string): { token: string; jobId: string } | null {
  try {
    const parsed = new URL(url);

    if (!/(^|\.)greenhouse\.io$/i.test(parsed.hostname)) {
      return null;
    }

    const match = /^\/(?:embed\/job_app)?\/?([a-z0-9._-]+)\/jobs\/(\d+)/i.exec(parsed.pathname);

    if (match) {
      return { token: match[1], jobId: match[2] };
    }

    const token = parsed.searchParams.get("for");
    const jobId = parsed.searchParams.get("token");

    return token && jobId && /^\d+$/.test(jobId) ? { token, jobId } : null;
  } catch {
    return null;
  }
}

function greenhouseType(type: string): FieldType {
  if (type === "textarea") return "textarea";
  if (type === "input_file") return "file";
  if (type === "input_text") return "text";
  if (type === "multi_value_single_select") return "select";
  if (type === "multi_value_multi_select") return "checkbox";

  return "other";
}

export function mapGreenhouseQuestions(questions: GreenhouseQuestion[], options: { eeo?: boolean } = {}): FormField[] {
  const fields: FormField[] = [];

  for (const question of questions) {
    for (const field of question.fields ?? []) {
      if (field.type === "input_hidden") {
        continue;
      }

      const label = (question.label ?? field.name).replace(/\s+/g, " ").trim();
      const name = field.name.replace(/\[\]$/, "");
      const type = greenhouseType(field.type);
      const choices = (field.values ?? []).map((value) => String(value.label ?? value.value ?? "")).filter(Boolean);

      fields.push({
        id: name,
        label,
        name: field.name,
        selector: `[name="${field.name}"]`,
        type,
        required: Boolean(question.required),
        options: choices.length > 0 ? choices : undefined,
        eeo: options.eeo || isEeoText(label, name) || undefined,
        description: question.description ? question.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || undefined : undefined,
      });
    }
  }

  return fields;
}

/**
 * `GET boards-api.greenhouse.io/v1/boards/<token>/jobs/<id>?questions=true`.
 * Demographic questions come back flagged `eeo`: they are shown, never answered.
 */
export async function fetchGreenhouseForm(
  token: string,
  jobId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FormExtraction> {
  const response = await fetchImpl(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs/${encodeURIComponent(jobId)}?questions=true`,
    { headers: HEADERS, cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Greenhouse respondeu HTTP ${response.status} ao ler o formulário.`);
  }

  const data = (await response.json()) as GreenhouseJob;
  const complianceQuestions = (data.compliance ?? []).flatMap((block) => block.questions ?? []);
  const fields = [
    ...mapGreenhouseQuestions(data.questions ?? []),
    ...mapGreenhouseQuestions(data.location_questions ?? []),
    ...mapGreenhouseQuestions(complianceQuestions, { eeo: true }),
    ...mapGreenhouseQuestions(data.demographic_questions?.questions ?? [], { eeo: true }),
  ];

  return { fields: fields.filter((field) => Boolean(field.label)), via: "greenhouse-api" };
}

// ---- Lever (HTML of the apply page) ---------------------------------------------

/** `jobs.lever.co/<org>/<id>[/apply]` and the EU host. */
export function parseLeverJobUrl(url: string): { host: string; org: string; jobId: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host !== "jobs.lever.co" && host !== "jobs.eu.lever.co") {
      return null;
    }

    const [org, jobId] = parsed.pathname.split("/").filter(Boolean);

    return org && jobId ? { host, org, jobId } : null;
  } catch {
    return null;
  }
}

export async function fetchLeverForm(url: string, fetchImpl: typeof fetch = fetch): Promise<FormExtraction> {
  const job = parseLeverJobUrl(url);

  if (!job) {
    throw new Error("URL de vaga da Lever inválida.");
  }

  const response = await fetchImpl(`https://${job.host}/${job.org}/${job.jobId}/apply`, {
    headers: { ...HEADERS, accept: "text/html" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Lever respondeu HTTP ${response.status} ao ler o formulário.`);
  }

  return extractionFromHtml(await response.text(), "lever-html", "form#application-form");
}

// ---- Dispatcher -------------------------------------------------------------------

export type FormExtractionDeps = {
  fetchImpl?: typeof fetch;
  /** Reads a rendered page (Playwright): used for Ashby and everything else. */
  browserExtract?: (url: string) => Promise<FormExtraction>;
  /** Board URL of the company, to resolve company-hosted Greenhouse links (`?gh_jid=`). */
  boardUrl?: string | null;
};

/**
 * Greenhouse via its public API, Lever via its apply page, everything else
 * (Ashby, company sites) in a headless browser. Never clicks or submits.
 */
export async function extractApplicationForm(applyUrl: string, deps: FormExtractionDeps = {}): Promise<FormExtraction> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const greenhouse = parseGreenhouseApplyUrl(applyUrl);

  if (greenhouse) {
    return fetchGreenhouseForm(greenhouse.token, greenhouse.jobId, fetchImpl);
  }

  // Company-hosted Greenhouse: `?gh_jid=<id>` plus the board token from the company's job board URL.
  const ghJid = (() => {
    try {
      return new URL(applyUrl).searchParams.get("gh_jid");
    } catch {
      return null;
    }
  })();
  const boardToken = deps.boardUrl ? parseGreenhouseBoardToken(deps.boardUrl) : null;

  if (ghJid && boardToken) {
    return fetchGreenhouseForm(boardToken, ghJid, fetchImpl);
  }

  if (parseLeverJobUrl(applyUrl)) {
    return fetchLeverForm(applyUrl, fetchImpl);
  }

  if (deps.browserExtract) {
    return deps.browserExtract(applyUrl);
  }

  return { fields: [], via: "none" };
}

function parseGreenhouseBoardToken(boardUrl: string): string | null {
  try {
    const parsed = new URL(boardUrl);

    if (!/(^|\.)greenhouse\.io$/i.test(parsed.hostname)) {
      return null;
    }

    return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

export { detectBlockedPage };
