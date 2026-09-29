import type { FormField, KitAnswers } from "./types";

/**
 * What `npm run apply:fill` does, decided in pure code so it is testable: which
 * fields get a value, which are attached, which are only highlighted. The plan
 * has no "submit" action on purpose: the script fills and stops.
 */

export type KitJson = {
  applyUrl: string | null;
  status: string;
  resumeUrl: string | null;
  coverLetter: string | null;
  fields: FormField[];
  answers: KitAnswers;
};

export type FillAction =
  | { kind: "fill"; field: FormField; value: string }
  | { kind: "select"; field: FormField; value: string }
  | { kind: "choose"; field: FormField; value: string }
  | { kind: "attach-resume"; field: FormField }
  /** Left for the user: highlighted in the page. */
  | { kind: "highlight"; field: FormField; reason: "eeo" | "unknown" | "cover-letter-file" };

export function buildFillPlan(kit: Pick<KitJson, "fields" | "answers" | "resumeUrl">): FillAction[] {
  const plan: FillAction[] = [];

  for (const field of kit.fields) {
    const answer = kit.answers[field.id];

    // Demographic questions are never answered, by anyone but the user.
    if (field.eeo || answer?.key === "eeo_demographic") {
      plan.push({ kind: "highlight", field, reason: "eeo" });
      continue;
    }

    if (field.type === "file") {
      if (answer?.key === "resume_upload" && kit.resumeUrl) {
        plan.push({ kind: "attach-resume", field });
      } else if (answer?.key === "cover_letter") {
        plan.push({ kind: "highlight", field, reason: "cover-letter-file" });
      } else {
        plan.push({ kind: "highlight", field, reason: "unknown" });
      }

      continue;
    }

    const value = answer?.value?.trim();

    if (!value) {
      plan.push({ kind: "highlight", field, reason: "unknown" });
      continue;
    }

    if (field.type === "select") {
      plan.push({ kind: "select", field, value });
    } else if (field.type === "radio" || field.type === "checkbox") {
      plan.push({ kind: "choose", field, value });
    } else {
      plan.push({ kind: "fill", field, value });
    }
  }

  return plan;
}

export function summarizePlan(plan: FillAction[]) {
  return {
    filled: plan.filter((action) => action.kind === "fill" || action.kind === "select" || action.kind === "choose").length,
    attached: plan.filter((action) => action.kind === "attach-resume").length,
    forYou: plan.filter((action) => action.kind === "highlight").length,
  };
}

/** Sources of actions the script must never perform (guarded by a test on the script's code). */
export const FORBIDDEN_SCRIPT_CALLS = [/\.click\(/, /\.dblclick\(/, /\.press\(/, /\.submit\(/, /requestSubmit/, /dispatchEvent\(/, /\.tap\(/] as const;
