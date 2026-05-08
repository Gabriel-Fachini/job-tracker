import assert from "node:assert/strict";
import test from "node:test";

import { parseResumeSelectionResponse } from "@/lib/ai/resume-generation";

test("parseResumeSelectionResponse keeps selected projects and caps at two", () => {
  const parsed = parseResumeSelectionResponse(
    JSON.stringify({
      experiences: [{ company: "Toro", bullets: ["b1", "b2"] }],
      skills: [{ category: "Frameworks", items: "React, Next.js" }],
      projects: [
        { name: "Job Tracker", reason: "alto alinhamento com automacao" },
        { name: "Media Traffic AI Analyst" },
        { name: "Extra Project" },
      ],
    }),
  );

  assert.deepEqual(parsed.projects, [
    { name: "Job Tracker", reason: "alto alinhamento com automacao" },
    { name: "Media Traffic AI Analyst", reason: undefined },
  ]);
});

test("parseResumeSelectionResponse falls back to empty projects array", () => {
  const parsed = parseResumeSelectionResponse(
    JSON.stringify({
      experiences: [{ company: "Toro", bullets: ["b1", "b2"] }],
      skills: [{ category: "Frameworks", items: "React, Next.js" }],
    }),
  );

  assert.deepEqual(parsed.projects, []);
});
