import assert from "node:assert/strict";
import test from "node:test";

import { buildResumeData } from "@/lib/latex/profile-adapter";
import type { ProfileSnapshot } from "@/lib/profile/editor";

const profile: ProfileSnapshot = {
  id: 1,
  fullName: "Gabriel Fachini",
  email: "gabriel@example.com",
  phone: null,
  linkedin: null,
  github: null,
  location: "Brasil",
  workModelPreference: "remote",
  companyTypePreference: null,
  valuesPreference: null,
  notes: null,
  masterResumePath: null,
  updatedAt: new Date("2026-05-08T12:00:00Z"),
  experiences: [
    {
      company: "Toro",
      role: "Software Engineer",
      startDate: "2022-01",
      endDate: null,
      isCurrent: true,
      description: null,
      bullets: [
        {
          content: "Built internal platform.",
          tags: [],
        },
      ],
    },
  ],
  skills: [
    {
      name: "TypeScript",
      level: "advanced",
      yearsExperience: 4,
      category: "language",
    },
  ],
  projects: [
    {
      name: "Job Tracker",
      description: "AI-assisted tracker",
      stack: ["Next.js", "TypeScript"],
      url: "https://example.com/job-tracker",
      impact: "Improved application workflow",
    },
    {
      name: "Media Traffic AI Analyst",
      description: "Analytics assistant",
      stack: ["Python", "OpenAI"],
      url: null,
      impact: "Faster media analysis",
    },
  ],
  education: [],
};

test("buildResumeData omits projects when AI selects none", () => {
  const data = buildResumeData(profile, {
    experiences: [{ company: "Toro", bullets: ["Built internal platform.", "Second bullet."] }],
    skills: [{ category: "Linguagens", items: "TypeScript" }],
    projects: [],
  });

  assert.deepEqual(data.projects, []);
});

test("buildResumeData keeps only selected projects with flexible name matching", () => {
  const data = buildResumeData(profile, {
    experiences: [{ company: "Toro", bullets: ["Built internal platform.", "Second bullet."] }],
    skills: [{ category: "Linguagens", items: "TypeScript" }],
    projects: [{ name: "job tracker" }, { name: "Media Traffic" }],
  });

  assert.deepEqual(
    data.projects.map((project) => project.name),
    ["Job Tracker", "Media Traffic AI Analyst"],
  );
});
