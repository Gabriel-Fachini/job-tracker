import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  github: text("github"),
  location: text("location"),
  workModelPreference: text("work_model_preference"),
  companyTypePreference: text("company_type_preference"),
  valuesPreference: text("values_preference"),
  notes: text("notes"),
  masterResumePath: text("master_resume_path"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const profileExperiences = sqliteTable("profile_experiences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profile.id),
  company: text("company").notNull(),
  role: text("role").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  isCurrent: integer("is_current", { mode: "boolean" }).default(false),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const profileExperienceBullets = sqliteTable(
  "profile_experience_bullets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    experienceId: integer("experience_id")
      .notNull()
      .references(() => profileExperiences.id),
    content: text("content").notNull(),
    tags: text("tags"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
);

export const profileSkills = sqliteTable("profile_skills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profile.id),
  name: text("name").notNull(),
  level: text("level"),
  yearsExperience: integer("years_experience"),
  category: text("category"),
});

export const profileProjects = sqliteTable("profile_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profile.id),
  name: text("name").notNull(),
  description: text("description"),
  stack: text("stack"),
  url: text("url"),
  impact: text("impact"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const profileEducation = sqliteTable("profile_education", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profile.id),
  institution: text("institution").notNull(),
  degree: text("degree"),
  field: text("field"),
  startDate: text("start_date"),
  endDate: text("end_date"),
});

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  website: text("website"),
  sector: text("sector"),
  size: text("size"),
  jobsBoardUrl: text("jobs_board_url"),
  jobBoardNavigationMode: text("job_board_navigation_mode")
    .notNull()
    .default("fetch"),
  atsProvider: text("ats_provider").notNull().default("auto"),
  atsBoardToken: text("ats_board_token"),
  glassdoorUrl: text("glassdoor_url"),
  status: text("status").notNull().default("monitoring"),
  /** `manual` (typed by the user), `aggregator` (created by a job source) or `yc_import`. */
  origin: text("origin").notNull().default("manual"),
  notes: text("notes"),
  /** Off skips the company on the next bulk radar run without changing status. */
  radarEnabled: integer("radar_enabled", { mode: "boolean" }).notNull().default(true),
  /** Optional override; without it the logo comes from the website's icons. */
  logoUrl: text("logo_url"),
  /** Cached logo file name under `<UPLOADS_PATH>/logos`. */
  logoPath: text("logo_path"),
  /** Last lookup attempt, so a site without an icon isn't fetched on every view. */
  logoCheckedAt: integer("logo_checked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  company: text("company"),
  title: text("title").notNull(),
  seniority: text("seniority"),
  workModel: text("work_model"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  description: text("description"),
  status: text("status").notNull().default("interesting"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id),
  status: text("status").notNull().default("applied"),
  recruiterName: text("recruiter_name"),
  recruiterContact: text("recruiter_contact"),
  trackingChannel: text("tracking_channel"),
  isReferral: integer("is_referral", { mode: "boolean" }).default(false).notNull(),
  usedResumeStatus: text("used_resume_status").notNull().default("unknown"),
  usedResumePath: text("used_resume_path"),
  usedResumeOriginalFilename: text("used_resume_original_filename"),
  generatedResumePath: text("generated_resume_path"),
  notes: text("notes"),
  appliedAt: integer("applied_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const jobLeads = sqliteTable(
  "job_leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceName: text("source_name").notNull().default("company_site"),
    description: text("description"),
    workModel: text("work_model"),
    seniority: text("seniority"),
    locationText: text("location_text"),
    salaryText: text("salary_text"),
    /** Aggregator kind (himalayas, remoteok...) or `company` for leads found on the company's own board. */
    sourceKind: text("source_kind"),
    /** Id of the vacancy in its source (ATS id, aggregator guid). */
    externalId: text("external_id"),
    /** Direct application URL when it differs from `source_url`. */
    applyUrl: text("apply_url"),
    /** Hash of normalized company + title: the same vacancy from two sources shares it. */
    dedupKey: text("dedup_key"),
    classificationStatus: text("classification_status")
      .notNull()
      .default("review"),
    classificationScore: integer("classification_score"),
    classificationReason: text("classification_reason"),
    /** Triage stage 1: worldwide, americas_or_latam_incl_brazil, brazil_explicit, us_only, us_canada_only, europe_uk_only, other_country_restricted, not_stated. */
    eligibility: text("eligibility"),
    /** JSON string[]: employee, contractor, eor. */
    contractTypes: text("contract_types"),
    /** Base salary normalized to USD per year (from the source or extracted from the text). */
    salaryMinUsdAnnual: integer("salary_min_usd_annual"),
    salaryMaxUsdAnnual: integer("salary_max_usd_annual"),
    /** Why the triage discarded it: location_ineligible, salary_below_min, job_family_mismatch, seniority_mismatch, contract_mismatch, low_fit, other. */
    discardReason: text("discard_reason"),
    /** Why the user discarded it by hand (the discard reasons plus not_interested). */
    userDiscardReason: text("user_discard_reason"),
    /** rules (hard filters / no profile), openai, jev or ollama. */
    triageEngine: text("triage_engine"),
    triageModel: text("triage_model"),
    triageConfidence: real("triage_confidence"),
    /** JSON with every answer, probability and threshold behind the decision. */
    triageDetails: text("triage_details"),
    userDecision: text("user_decision").notNull().default("none"),
    userDecisionAt: integer("user_decision_at", { mode: "timestamp" }),
    promotedToApplicationId: integer("promoted_to_application_id").references(
      () => applications.id,
    ),
    discoveredAt: integer("discovered_at", { mode: "timestamp" }).notNull(),
    lastViewed: integer("last_viewed", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("job_leads_company_source_url_unique").on(
      table.companyId,
      table.sourceUrl,
    ),
    index("job_leads_dedup_key_idx").on(table.dedupKey),
  ],
);

/** Aggregated job feeds (one feed -> many companies). Seeded in code on first read. */
export const jobSources = sqliteTable("job_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** himalayas, remoteok, weworkremotely, jobicy or hn_whoishiring. */
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  /** JSON: categories/tags for the fetcher. */
  config: text("config"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  /** Opaque marker of the newest vacancy seen (Himalayas: last pubDate). */
  lastCursor: text("last_cursor"),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const applicationStages = sqliteTable("application_stages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  label: text("label").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const applicationStatusHistory = sqliteTable(
  "application_status_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applications.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedAt: integer("changed_at", { mode: "timestamp" }).notNull(),
  },
);

/**
 * Assisted application kit (one per application): English resume, cover
 * letter, the form's fields and the answers prepared for them. Nothing here is
 * ever submitted for the user.
 */
export const applicationKits = sqliteTable("application_kits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .unique()
    .references(() => applications.id),
  language: text("language").notNull().default("en"),
  applyUrl: text("apply_url"),
  /** Absolute path of the English PDF generated for this application. */
  resumePath: text("resume_path"),
  coverLetter: text("cover_letter"),
  /** JSON FormField[]: label, type, required, options (see src/lib/apply/types.ts). */
  formFields: text("form_fields"),
  /** JSON map fieldId -> answer (value, key, source, aiDraft...). */
  answers: text("answers"),
  /** draft, ready or submitted_by_user. */
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * International search preferences. Single row (the app has one user); no row
 * means every preference-based filter is off. List columns hold JSON arrays.
 */
export const searchPreferences = sqliteTable("search_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  minMonthlyUsd: integer("min_monthly_usd"),
  minAnnualUsd: integer("min_annual_usd"),
  /** JSON string[]: employee, contractor, eor, pj. */
  acceptedContracts: text("accepted_contracts"),
  /** JSON string[]: worldwide, americas, latam, brazil. */
  acceptedEligibility: text("accepted_eligibility"),
  timezone: text("timezone"),
  maxUtcOffsetDistanceHours: integer("max_utc_offset_distance_hours"),
  targetSeniorities: text("target_seniorities"),
  targetJobFamilies: text("target_job_families"),
  titleIncludeKeywords: text("title_include_keywords"),
  titleExcludeKeywords: text("title_exclude_keywords"),
  /** JSON object with default form answers (work authorization, notice period...). */
  defaultAnswers: text("default_answers"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const resumes = sqliteTable("resumes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").references(() => applications.id),
  jobId: integer("job_id").references(() => jobs.id),
  pdfPath: text("pdf_path").notNull(),
  texPath: text("tex_path").notNull(),
  generationPrompt: text("generation_prompt"),
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
});

export const glassdoorSnapshots = sqliteTable(
  "glassdoor_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    /** Technical key used only to match companies; the name/url live in `dataJson`. */
    glassdoorId: integer("glassdoor_id").notNull(),
    collectedAt: integer("collected_at", { mode: "timestamp" }).notNull(),
    /** Lower bound the collector used for reviews/interviews; null = full history. */
    since: text("since"),
    overall: real("overall"),
    cultureValues: real("culture_values"),
    workLifeBalance: real("work_life_balance"),
    compensationBenefits: real("compensation_benefits"),
    careerOpportunities: real("career_opportunities"),
    seniorManagement: real("senior_management"),
    diversityInclusion: real("diversity_inclusion"),
    recommendToFriend: real("recommend_to_friend"),
    businessOutlook: real("business_outlook"),
    ceoApproval: real("ceo_approval"),
    reviewCount: integer("review_count"),
    interviewDifficulty: real("interview_difficulty"),
    interviewPositive: integer("interview_positive"),
    interviewNeutral: integer("interview_neutral"),
    interviewNegative: integer("interview_negative"),
    interviewCount: integer("interview_count"),
    /** `{ employer, industry_benchmark, distribution, interview_channel_counts }`. */
    dataJson: text("data_json"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("glassdoor_snapshots_company_collected_unique").on(
      table.companyId,
      table.collectedAt,
    ),
    index("glassdoor_snapshots_glassdoor_id_idx").on(table.glassdoorId),
  ],
);

export const glassdoorReviews = sqliteTable("glassdoor_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  glassdoorReviewId: integer("glassdoor_review_id").notNull().unique(),
  /** ISO date-time as sent by Glassdoor. */
  date: text("date"),
  jobTitle: text("job_title"),
  rating: integer("rating"),
  summary: text("summary"),
  pros: text("pros"),
  cons: text("cons"),
  advice: text("advice"),
  isCurrent: integer("is_current", { mode: "boolean" }),
  yearsEmployed: integer("years_employed"),
  /** `{ location }`. */
  extraJson: text("extra_json"),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull(),
});

export const glassdoorInterviews = sqliteTable("glassdoor_interviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  glassdoorInterviewId: integer("glassdoor_interview_id").notNull().unique(),
  date: text("date"),
  jobTitle: text("job_title"),
  difficulty: text("difficulty"),
  experience: text("experience"),
  outcome: text("outcome"),
  durationDays: integer("duration_days"),
  process: text("process"),
  /** `string[]`. */
  questionsJson: text("questions_json"),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull(),
});

export const glassdoorSalaries = sqliteTable("glassdoor_salaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  snapshotId: integer("snapshot_id")
    .notNull()
    .references(() => glassdoorSnapshots.id),
  jobTitle: text("job_title").notNull(),
  salaryCount: integer("salary_count"),
  baseP10: real("base_p10"),
  baseP25: real("base_p25"),
  baseP50: real("base_p50"),
  baseP75: real("base_p75"),
  baseP90: real("base_p90"),
  totalP10: real("total_p10"),
  totalP25: real("total_p25"),
  totalP50: real("total_p50"),
  totalP75: real("total_p75"),
  totalP90: real("total_p90"),
  /** `{ most_recent }`. */
  extraJson: text("extra_json"),
});

export const profileRelations = relations(profile, ({ many }) => ({
  experiences: many(profileExperiences),
  skills: many(profileSkills),
  projects: many(profileProjects),
  education: many(profileEducation),
}));

export const profileExperiencesRelations = relations(
  profileExperiences,
  ({ one, many }) => ({
    profile: one(profile, {
      fields: [profileExperiences.profileId],
      references: [profile.id],
    }),
    bullets: many(profileExperienceBullets),
  }),
);

export const profileExperienceBulletsRelations = relations(
  profileExperienceBullets,
  ({ one }) => ({
    experience: one(profileExperiences, {
      fields: [profileExperienceBullets.experienceId],
      references: [profileExperiences.id],
    }),
  }),
);

export const profileSkillsRelations = relations(profileSkills, ({ one }) => ({
  profile: one(profile, {
    fields: [profileSkills.profileId],
    references: [profile.id],
  }),
}));

export const profileProjectsRelations = relations(
  profileProjects,
  ({ one }) => ({
    profile: one(profile, {
      fields: [profileProjects.profileId],
      references: [profile.id],
    }),
  }),
);

export const profileEducationRelations = relations(
  profileEducation,
  ({ one }) => ({
    profile: one(profile, {
      fields: [profileEducation.profileId],
      references: [profile.id],
    }),
  }),
);

export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
  jobLeads: many(jobLeads),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  applications: many(applications),
  resumes: many(resumes),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
  stages: many(applicationStages),
  statusHistory: many(applicationStatusHistory),
  resumes: many(resumes),
  promotedLeads: many(jobLeads),
}));

export const jobLeadsRelations = relations(jobLeads, ({ one }) => ({
  company: one(companies, {
    fields: [jobLeads.companyId],
    references: [companies.id],
  }),
  promotedToApplication: one(applications, {
    fields: [jobLeads.promotedToApplicationId],
    references: [applications.id],
  }),
}));

export const applicationStagesRelations = relations(
  applicationStages,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationStages.applicationId],
      references: [applications.id],
    }),
  }),
);

export const applicationStatusHistoryRelations = relations(
  applicationStatusHistory,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationStatusHistory.applicationId],
      references: [applications.id],
    }),
  }),
);

export const resumesRelations = relations(resumes, ({ one }) => ({
  application: one(applications, {
    fields: [resumes.applicationId],
    references: [applications.id],
  }),
  job: one(jobs, {
    fields: [resumes.jobId],
    references: [jobs.id],
  }),
}));

export type Profile = typeof profile.$inferSelect;
export type NewProfile = typeof profile.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type JobSource = typeof jobSources.$inferSelect;
export type JobLead = typeof jobLeads.$inferSelect;
export type NewJobLead = typeof jobLeads.$inferInsert;
export type ApplicationKit = typeof applicationKits.$inferSelect;
export type SearchPreferencesRow = typeof searchPreferences.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
