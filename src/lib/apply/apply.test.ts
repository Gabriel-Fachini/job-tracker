import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { mapFieldHeuristically } from "./field-mapping";
import { buildFillPlan, FORBIDDEN_SCRIPT_CALLS } from "./fill-plan";
import type { FormField, KitAnswers } from "./types";

function field(partial: Partial<FormField> & Pick<FormField, "id" | "label">): FormField {
  return { type: "text", required: false, ...partial };
}

test("apply-fill script never clicks, presses keys or submits", () => {
  const source = readFileSync(path.resolve("scripts/apply-fill.ts"), "utf8");

  for (const pattern of FORBIDDEN_SCRIPT_CALLS) {
    assert.equal(pattern.test(source), false, `scripts/apply-fill.ts must not match ${pattern}`);
  }
});

test("fill plan has no submit action and only highlights demographic questions", () => {
  const fields: FormField[] = [
    field({ id: "email", label: "Email", type: "email" }),
    field({ id: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Decline to self-identify"], eeo: true }),
    field({ id: "veteran", label: "Veteran status", type: "select", options: ["Yes", "No"] }),
    field({ id: "resume", label: "Resume/CV", type: "file" }),
    field({ id: "why", label: "Why do you want to work here?", type: "textarea" }),
  ];
  const answers: KitAnswers = {
    email: { key: "email", value: "candidate@example.com", source: "profile" },
    gender: { key: "eeo_demographic", value: "Decline to self-identify", source: "manual" },
    veteran: { key: "eeo_demographic", value: "No", source: "manual" },
    resume: { key: "resume_upload", value: null, source: "resume" },
    why: { key: "free_text", value: null, source: "none" },
  };

  const plan = buildFillPlan({ fields, answers, resumeUrl: "/api/applications/1/kit/resume" });
  const byId = Object.fromEntries(plan.map((action) => [action.field.id, action]));

  assert.deepEqual(byId.email, { kind: "fill", field: fields[0], value: "candidate@example.com" });
  // Even with a value stored, EEO questions are left to the user.
  assert.equal(byId.gender.kind, "highlight");
  assert.equal(byId.veteran.kind, "highlight");
  assert.equal(byId.resume.kind, "attach-resume");
  assert.equal(byId.why.kind, "highlight");
  assert.ok(plan.every((action) => ["fill", "select", "choose", "attach-resume", "highlight"].includes(action.kind)));
});

test("resume is not attached when the kit has no resume", () => {
  const resume = field({ id: "resume", label: "Resume", type: "file" });
  const plan = buildFillPlan({
    fields: [resume],
    answers: { resume: { key: "resume_upload", value: null, source: "resume" } },
    resumeUrl: null,
  });

  assert.equal(plan[0].kind, "highlight");
});

test("heuristics map the standard application fields", () => {
  const cases: Array<[Partial<FormField> & Pick<FormField, "id" | "label">, string]> = [
    [{ id: "first_name", label: "First Name", name: "first_name" }, "first_name"],
    [{ id: "last_name", label: "Last Name", name: "last_name" }, "last_name"],
    [{ id: "email", label: "Email", type: "email" }, "email"],
    [{ id: "phone", label: "Phone", type: "tel" }, "phone"],
    [{ id: "li", label: "LinkedIn Profile", type: "url" }, "linkedin"],
    [{ id: "gh", label: "GitHub URL", type: "url" }, "github"],
    [{ id: "resume", label: "Resume/CV", type: "file" }, "resume_upload"],
    [{ id: "auth", label: "Are you legally authorized to work in the United States?", type: "select" }, "us_work_authorization"],
    [{ id: "visa", label: "Will you now or in the future require visa sponsorship?", type: "select" }, "requires_sponsorship"],
    [{ id: "salary", label: "What are your salary expectations?" }, "salary_expectation"],
    [{ id: "hear", label: "How did you hear about us?", type: "select" }, "how_did_you_hear"],
  ];

  for (const [partial, expected] of cases) {
    assert.equal(mapFieldHeuristically(field(partial))?.key, expected, partial.label);
  }
});

test("demographic questions always map to eeo_demographic", () => {
  assert.equal(mapFieldHeuristically(field({ id: "g", label: "Gender", type: "select", eeo: true }))?.key, "eeo_demographic");
});
