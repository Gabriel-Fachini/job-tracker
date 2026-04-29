import assert from "node:assert/strict";
import test from "node:test";

import { parseExtractedProfileResponse } from "@/lib/ai/ollama";

test("normaliza datas opcionais validas sem falhar a extração", () => {
  const parsed = parseExtractedProfileResponse(
    JSON.stringify({
      profile: {
        fullName: "Gabriel Fachini",
        email: "gabriel@example.com",
        phone: null,
        linkedin: null,
        github: null,
        location: null,
        workModelPreference: "remote",
        notes: null,
        masterResumePath: null,
      },
      experiences: [
        {
          company: "Cubbo Logistics",
          role: "Engenheiro de Software Global",
          startDate: "06/2025",
          endDate: "09/2025",
          isCurrent: false,
          description: null,
          bullets: [],
        },
      ],
      skills: [],
      projects: [],
      education: [
        {
          institution: "Universidade de Sao Paulo",
          degree: "Bacharelado",
          field: "Sistemas de Informacao",
          startDate: "N/A",
          endDate: "N/A",
        },
      ],
    }),
  );

  assert.equal(parsed.experiences[0]?.startDate, "2025-06");
  assert.equal(parsed.experiences[0]?.endDate, "2025-09");
  assert.equal(parsed.education[0]?.startDate, null);
  assert.equal(parsed.education[0]?.endDate, null);
});

test("aceita datas correntes opcionais como null", () => {
  const parsed = parseExtractedProfileResponse(
    JSON.stringify({
      profile: {
        fullName: "Gabriel Fachini",
        email: null,
        phone: null,
        linkedin: null,
        github: null,
        location: null,
        workModelPreference: null,
        notes: null,
        masterResumePath: null,
      },
      experiences: [
        {
          company: "Atual Empresa",
          role: "Staff Engineer",
          startDate: "2024-01",
          endDate: "Atual",
          isCurrent: true,
          description: null,
          bullets: [],
        },
      ],
      skills: [],
      projects: [],
      education: [],
    }),
  );

  assert.equal(parsed.experiences[0]?.endDate, null);
  assert.equal(parsed.experiences[0]?.isCurrent, true);
});
