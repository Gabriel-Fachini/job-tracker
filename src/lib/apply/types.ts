/**
 * Assisted application: the kit never submits anything. These types describe a
 * form's fields and the answers prepared for them.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "other";

export type FormField = {
  /** Stable id inside the form (name, id or a slug of the label). */
  id: string;
  label: string;
  /** The input's `name` attribute when it has one. */
  name?: string;
  /** CSS selector the fill script tries first. */
  selector?: string;
  type: FieldType;
  required: boolean;
  /** Option labels for select/radio/checkbox groups. */
  options?: string[];
  /** Demographic / EEO question: never answered. */
  eeo?: boolean;
  description?: string;
};

export const fieldKeys = [
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "linkedin",
  "github",
  "portfolio",
  "location",
  "resume_upload",
  "cover_letter",
  "us_work_authorization",
  "requires_sponsorship",
  "salary_expectation",
  "notice_period",
  "timezone",
  "years_experience",
  "how_did_you_hear",
  "eeo_demographic",
  "free_text",
  "unknown",
] as const;

export type FieldKey = (typeof fieldKeys)[number];

export function isFieldKey(value: unknown): value is FieldKey {
  return typeof value === "string" && (fieldKeys as readonly string[]).includes(value);
}

export type AnswerSource =
  | "profile"
  | "preferences"
  | "cover_letter"
  | "resume"
  | "ai_draft"
  | "manual"
  | "none";

export type KitAnswer = {
  key: FieldKey;
  /** null = the user fills it in (unknown, EEO or missing data). */
  value: string | null;
  source: AnswerSource;
  /** Generated draft the user must review ("rascunho IA"). */
  aiDraft?: boolean;
  /** Mapping confidence (0-1). */
  confidence?: number;
  note?: string;
};

export type KitAnswers = Record<string, KitAnswer>;

export type FormExtraction = {
  fields: FormField[];
  /** A login wall or CAPTCHA stopped the reading: fill the form by hand. */
  blocked?: "captcha" | "login";
  via: "greenhouse-api" | "lever-html" | "browser" | "none";
};

export const kitStatusValues = ["draft", "ready", "submitted_by_user"] as const;
export type KitStatus = (typeof kitStatusValues)[number];
