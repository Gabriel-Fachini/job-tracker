import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyJobLead,
  parseClassificationResponse,
} from "./classification";

test("classifyJobLead returns review when no profile is configured", async () => {
  const result = await classifyJobLead(
    {
      title: "Senior Frontend Engineer",
      description: "React, TypeScript e produto",
      sourceUrl: "https://example.com/jobs/frontend",
      sourceName: "company_site",
      workModel: "remote",
      seniority: "senior",
      locationText: null,
      salaryText: null,
    },
    {
      companyName: "Acme",
      profile: null,
      feedbackSummary: {
        promotedExamples: [],
        dismissedExamples: [],
      },
    },
  );

  assert.equal(result.decision, "review");
  assert.equal(result.score, 40);
  assert.match(result.missingSignals.join(" "), /Perfil principal indisponivel/);
});

test("parseClassificationResponse normalizes invalid payloads", () => {
  const result = parseClassificationResponse(
    JSON.stringify({
      decision: "unexpected",
      score: 131,
      reason: "",
    }),
  );

  assert.deepEqual(result, {
    decision: "review",
    score: 100,
    reason: "Classificacao sem justificativa detalhada.",
    matchedSignals: [],
    riskSignals: [],
    missingSignals: [],
  });
});

test("parseClassificationResponse accepts fenced json payloads", () => {
  const result = parseClassificationResponse(`
    \`\`\`json
    {
      "decision": "interesting",
      "score": 82,
      "reason": "Boa aderencia com stack e senioridade.",
      "matchedSignals": ["Stack em comum: React"],
      "riskSignals": [],
      "missingSignals": []
    }
    \`\`\`
  `);

  assert.deepEqual(result, {
    decision: "interesting",
    score: 82,
    reason: "Boa aderencia com stack e senioridade.",
    matchedSignals: ["Stack em comum: React"],
    riskSignals: [],
    missingSignals: [],
  });
});
