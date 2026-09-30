import { normalizeSearchPreferences } from "@/lib/search-preferences";

import type { DiscardReason, EligibilityValue, TriageJob } from "../types";

/**
 * Fictional vacancies with the answers a careful reader would give, used by
 * `npm run triage:eval` to calibrate the stage 1 questions and thresholds per
 * engine. Companies, people and numbers are invented. Omitted expectations are
 * not scored (the case is genuinely ambiguous).
 */

export type EvalExpectation = {
  /** Expected stage 0 outcome with `evalPreferences`: a discard reason, or null to pass. */
  stage0: DiscardReason | null;
  eligibility?: EligibilityValue;
  contract?: "employee_only" | "contractor_or_eor_ok" | "not_stated";
  seniority?: "intern" | "junior" | "mid" | "senior" | "staff_plus" | "manager" | "not_stated";
  jobFamily?: string;
  usAuthorizationRequired?: boolean;
  /** Base salary in USD per year the model should pick from the candidates. */
  salaryAnnual?: { min: number; max: number };
  redFlags?: boolean;
};

export type EvalJob = { id: string; job: TriageJob; expected: EvalExpectation };

/** Generic preferences for the eval (not anyone's real ones). */
export const evalPreferences = normalizeSearchPreferences({
  minMonthlyUsd: 4500,
  acceptedContracts: ["contractor", "eor", "pj"],
  acceptedEligibility: ["worldwide", "latam", "brazil"],
  targetSeniorities: ["senior", "staff_plus"],
  targetJobFamilies: ["backend", "fullstack", "devops"],
  titleExcludeKeywords: ["intern", "sales", "recruiter"],
});

function make(
  id: string,
  title: string,
  description: string,
  expected: EvalExpectation,
  extra: Partial<TriageJob> = {},
): EvalJob {
  return {
    id,
    expected,
    job: {
      title,
      description,
      sourceUrl: `https://eval.example/jobs/${id}`,
      sourceName: "himalayas",
      workModel: "remote",
      seniority: null,
      locationText: "Remote",
      salaryText: null,
      companyName: "Eval Company",
      ...extra,
    },
  };
}

export const evalJobs: EvalJob[] = [
  make(
    "01-worldwide-contractor",
    "Senior Backend Engineer",
    "We are a remote-first company. Work from anywhere in the world. We hire contractors through Deel. Base salary: $120k-$150k per year.",
    { stage0: null, eligibility: "worldwide", contract: "contractor_or_eor_ok", seniority: "senior", jobFamily: "backend", usAuthorizationRequired: false },
  ),
  make("02-us-only-phrase", "Backend Engineer", "Build payment APIs. This role is US only.", { stage0: "location_ineligible" }),
  make("03-sales-title", "Sales Development Representative", "Own outbound pipeline.", { stage0: "job_family_mismatch" }),
  make(
    "04-latam-staff",
    "Staff Platform Engineer",
    "Remote, LATAM. Independent contractors are welcome. Compensation: USD 9,000/month. You will lead our infrastructure roadmap and mentor senior engineers.",
    { stage0: null, eligibility: "americas_or_latam_incl_brazil", contract: "contractor_or_eor_ok", seniority: "staff_plus", jobFamily: "devops", usAuthorizationRequired: false },
    { locationText: "Remote - LATAM" },
  ),
  make(
    "05-us-employee-visa",
    "Software Engineer II",
    "Remote (US). Candidates must be authorized to work in the United States; we do not sponsor visas. W-2 employees only, with benefits.",
    { stage0: null, eligibility: "us_only", contract: "employee_only", seniority: "mid", jobFamily: "backend", usAuthorizationRequired: true },
    { locationText: "Remote (US)" },
  ),
  make(
    "06-americas-hourly",
    "Full-Stack Engineer",
    "Anywhere in the Americas. Independent contractor agreement. Rate: $70-90 per hour.",
    { stage0: null, eligibility: "americas_or_latam_incl_brazil", contract: "contractor_or_eor_ok", seniority: "not_stated", jobFamily: "fullstack", usAuthorizationRequired: false, salaryAnnual: { min: 145600, max: 187200 } },
    { locationText: "Remote - Americas" },
  ),
  make(
    "07-brazil-junior",
    "Junior Backend Developer",
    "Remote from Brazil. We offer PJ (contractor) or CLT. You will maintain Node.js services.",
    { stage0: null, eligibility: "brazil_explicit", contract: "contractor_or_eor_ok", seniority: "junior", jobFamily: "backend", usAuthorizationRequired: false },
    { locationText: "Brazil" },
  ),
  make(
    "08-eu-only",
    "DevOps Engineer",
    "Remote within the EU/EEA only. Employment contract through our local entity in your country.",
    { stage0: null, eligibility: "europe_uk_only", contract: "employee_only", seniority: "not_stated", jobFamily: "devops", usAuthorizationRequired: false },
  ),
  // The salary is only in the text (no structured field): stage 0 cannot see it, stage 1 extracts it.
  make(
    "09-low-salary-in-text",
    "Backend Engineer, Payments",
    "Remote. Salary: USD 2,500/month.",
    { stage0: null, eligibility: "not_stated", contract: "not_stated", jobFamily: "backend", usAuthorizationRequired: false, salaryAnnual: { min: 30000, max: 30000 } },
  ),
  make(
    "09b-low-salary-structured",
    "Backend Engineer, Ledger",
    "Remote.",
    { stage0: "salary_below_min" },
    { salaryText: "USD 2,500 / month" },
  ),
  make("10-data-title", "Senior Data Engineer", "Build data pipelines.", { stage0: "job_family_mismatch" }),
  make(
    "11-manager",
    "Engineering Manager, Backend",
    "Lead a team of six backend engineers. Remote, open to candidates worldwide.",
    { stage0: null, eligibility: "worldwide", contract: "not_stated", seniority: "manager", jobFamily: "backend", usAuthorizationRequired: false },
  ),
  make("12-principal-title", "Principal Engineer", "Set technical direction.", { stage0: "job_family_mismatch" }),
  make(
    "13-worldwide-pacific",
    "Backend Engineer (Go)",
    "Work from anywhere. You must work US Pacific time hours, with overlap for daily standups.",
    { stage0: null, eligibility: "worldwide", contract: "not_stated", seniority: "not_stated", jobFamily: "backend", usAuthorizationRequired: false },
  ),
  make(
    "14-us-canada",
    "Senior Software Engineer",
    "Remote (Canada or US). North American time zones.",
    { stage0: null, eligibility: "us_canada_only", contract: "not_stated", seniority: "senior", usAuthorizationRequired: false },
    { locationText: "Remote (Canada or US)" },
  ),
  make(
    "15-latam-named",
    "Senior Backend Engineer",
    "Remote. Open to Brazil, Argentina, Colombia or Mexico. Contractor (PJ) or Employer of Record.",
    { stage0: null, eligibility: "brazil_explicit", contract: "contractor_or_eor_ok", seniority: "senior", jobFamily: "backend", usAuthorizationRequired: false },
    { locationText: "Remote - Brazil, Argentina, Colombia, Mexico" },
  ),
  make(
    "16-india-only",
    "DevOps / SRE Engineer",
    "Remote within India only. Full-time employees.",
    { stage0: null, eligibility: "other_country_restricted", contract: "employee_only", jobFamily: "devops", usAuthorizationRequired: false },
    { locationText: "India" },
  ),
  make(
    "17-salary-candidates",
    "Backend Engineer",
    "Remote. Compensation: $180k base salary per year plus a $30k annual bonus.",
    { stage0: null, eligibility: "not_stated", contract: "not_stated", jobFamily: "backend", usAuthorizationRequired: false, salaryAnnual: { min: 180000, max: 180000 } },
  ),
  make(
    "18-red-flags",
    "Senior Backend Engineer",
    "Commission-only role. No base salary. Two-week unpaid trial period before any offer. Remote, worldwide.",
    { stage0: null, eligibility: "worldwide", contract: "not_stated", seniority: "senior", jobFamily: "backend", usAuthorizationRequired: false, redFlags: true },
  ),
  make(
    "19-worldwide-employee",
    "Backend Engineer",
    "Remote worldwide. Full-time employees only, paid through local payroll in your country.",
    { stage0: null, eligibility: "worldwide", contract: "employee_only", jobFamily: "backend", usAuthorizationRequired: false },
  ),
  make(
    "20-latam-na",
    "Senior Platform Engineer",
    "Remote across LATAM and North America. Overlap with Eastern time is expected. Contractor or EOR.",
    { stage0: null, eligibility: "americas_or_latam_incl_brazil", contract: "contractor_or_eor_ok", seniority: "senior", jobFamily: "devops", usAuthorizationRequired: false },
  ),
];

/** A fictional candidate for the red-flag question of stage 2. */
export const evalCandidate: Record<string, unknown> = {
  years_of_experience: 8,
  seniority: "senior",
  target_seniorities: ["senior", "staff_plus"],
  target_job_families: ["backend", "fullstack", "devops"],
  skills: [
    { name: "TypeScript", level: "expert", years: 7 },
    { name: "Node.js", level: "advanced", years: 7 },
    { name: "PostgreSQL", level: "advanced", years: 6 },
  ],
  projects_stack: ["Node.js", "Redis"],
  company_type_preference: null,
  values_preference: null,
};
