import { isEeoText } from "./form-extract";
import type { FieldKey, FormField } from "./types";

/**
 * Field -> answer key. Code heuristics first (name, type, label); what they
 * cannot place goes to a model (`field-mapping-model.ts`). Demographic/EEO
 * questions are always `eeo_demographic`: they are never answered.
 */

export type FieldMapping = { key: FieldKey; confidence: number; via: "heuristic" | "model" };

type Rule = { key: FieldKey; pattern: RegExp; confidence?: number; types?: FormField["type"][] };

function haystack(field: FormField) {
  return `${field.name ?? ""} ${field.label}`.toLowerCase().replace(/[_\[\]]+/g, " ");
}

// Order matters: the first matching rule wins.
const RULES: Rule[] = [
  { key: "resume_upload", pattern: /\b(resume|résumé|cv|curriculum)\b/, types: ["file"], confidence: 0.98 },
  { key: "cover_letter", pattern: /cover\s*letter|carta de apresenta/, confidence: 0.95 },
  { key: "email", pattern: /e-?mail/, confidence: 0.98 },
  { key: "phone", pattern: /\b(phone|mobile|telephone|cell)\b/, confidence: 0.95 },
  { key: "linkedin", pattern: /linkedin/, confidence: 0.97 },
  { key: "github", pattern: /github/, confidence: 0.97 },
  { key: "portfolio", pattern: /portfolio|personal (web)?site|website|other website|\burl\b|link to your work/, confidence: 0.8 },
  { key: "first_name", pattern: /\b(first name|given name|preferred (first )?name|firstname)\b/, confidence: 0.92 },
  { key: "last_name", pattern: /\b(last name|surname|family name|lastname)\b/, confidence: 0.95 },
  { key: "full_name", pattern: /^\s*(full\s+)?name\s*$|\bfull\s+name\b|^\s*your name\s*$/, confidence: 0.92 },
  { key: "us_work_authorization", pattern: /authori[sz]ed to work|work authori[sz]ation|legally (authori[sz]ed|eligible)|right to work|eligible to work/, confidence: 0.92 },
  { key: "requires_sponsorship", pattern: /sponsor|visa/, confidence: 0.9 },
  { key: "salary_expectation", pattern: /salary|compensation|pay expectation|expected (pay|salary|compensation)|desired (pay|salary)/, confidence: 0.9 },
  { key: "notice_period", pattern: /notice period|start date|available to start|when can you start|availability/, confidence: 0.88 },
  { key: "timezone", pattern: /time ?zone/, confidence: 0.9 },
  { key: "years_experience", pattern: /years of (professional |relevant |work )?experience|how many years/, confidence: 0.88 },
  { key: "how_did_you_hear", pattern: /how did you (hear|find|learn)|where did you (hear|find)|referral source|how you heard/, confidence: 0.9 },
  { key: "location", pattern: /\b(location|city|current location|where are you (based|located)|country of residence|address)\b/, confidence: 0.85 },
];

const QUESTION_LIKE = /\?|\b(why|tell us|describe|what (excites|interests|motivates)|share|explain|how would)\b/i;

/** Null when the heuristics cannot place the field (it goes to the model). */
export function mapFieldHeuristically(field: FormField): FieldMapping | null {
  if (field.eeo || isEeoText(field.label, field.name)) {
    return { key: "eeo_demographic", confidence: 0.99, via: "heuristic" };
  }

  const text = haystack(field);

  for (const rule of RULES) {
    if (rule.types && !rule.types.includes(field.type)) {
      continue;
    }

    if (rule.pattern.test(text)) {
      // A file field can only be the resume or the cover letter, never plain text data.
      if (field.type === "file" && rule.key !== "resume_upload" && rule.key !== "cover_letter") {
        continue;
      }

      return { key: rule.key, confidence: rule.confidence ?? 0.8, via: "heuristic" };
    }
  }

  // Type hints when the label is opaque.
  if (field.type === "email") return { key: "email", confidence: 0.9, via: "heuristic" };
  if (field.type === "tel") return { key: "phone", confidence: 0.9, via: "heuristic" };

  if (field.type === "file") {
    return { key: "resume_upload", confidence: 0.5, via: "heuristic" };
  }

  if (field.type === "textarea" && QUESTION_LIKE.test(field.label) && field.label.length > 20) {
    return { key: "free_text", confidence: 0.7, via: "heuristic" };
  }

  return null;
}

/** Below this confidence a mapping counts as unknown (the user fills it in). */
export const MIN_MAPPING_CONFIDENCE = 0.6;

export function mapFieldsHeuristically(fields: FormField[]): {
  mapped: Record<string, FieldMapping>;
  unresolved: FormField[];
} {
  const mapped: Record<string, FieldMapping> = {};
  const unresolved: FormField[] = [];

  for (const field of fields) {
    const mapping = mapFieldHeuristically(field);

    if (mapping && mapping.confidence >= MIN_MAPPING_CONFIDENCE) {
      mapped[field.id] = mapping;
    } else {
      unresolved.push(field);
    }
  }

  return { mapped, unresolved };
}
