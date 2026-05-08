import assert from "node:assert/strict";
import test from "node:test";

import { renderResumeTex } from "@/lib/latex/render";
import { sampleProfile } from "@/lib/latex/__fixtures__/sample-profile";

test("renderResumeTex skips projects section when there are no projects", () => {
  const tex = renderResumeTex({
    ...sampleProfile,
    projects: [],
  });

  assert.equal(tex.includes("\\section*{PROJETOS}"), false);
});

test("renderResumeTex renders projects section when selected projects exist", () => {
  const tex = renderResumeTex({
    ...sampleProfile,
    projects: [
      {
        name: "Job Tracker",
        stack: "Next.js, TypeScript",
        description: "AI-assisted tracker",
        impact: "Improved application workflow",
      },
    ],
  });

  assert.equal(tex.includes("\\section*{PROJETOS}"), true);
  assert.equal(tex.includes("Job Tracker"), true);
});
