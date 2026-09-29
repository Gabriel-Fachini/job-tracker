import assert from "node:assert/strict";
import test from "node:test";

import type { LeadListItem } from "@/components/leads/types";
import { emptyLeadTriage } from "@/lib/job-leads/defaults";
import { runMonitoringForCompany } from "./index";

function snapshot(lead: { sourceUrl: string; title: string }): LeadListItem {
  return {
    id: 1,
    title: lead.title,
    sourceUrl: lead.sourceUrl,
    sourceName: "ashby",
    sourceKind: null,
    applyUrl: null,
    ...emptyLeadTriage,
    description: null,
    workModel: "remote",
    seniority: null,
    locationText: null,
    salaryText: null,
    classificationStatus: "review",
    classificationScore: 50,
    classificationReason: "ok",
    userDecision: "none",
    promotedToApplicationId: null,
    discoveredAt: new Date(),
    updatedAt: new Date(),
    companyId: 1,
    companyName: "Acme",
  };
}

test("runMonitoringForCompany carries prefetched salary and work model into the persisted lead", async () => {
  const persisted: Array<{
    salaryText: string | null;
    workModel: string | null;
    locationText: string | null;
    sourceName: string;
  }> = [];

  await runMonitoringForCompany(
    {
      id: 1,
      name: "Acme",
      jobsBoardUrl: "https://jobs.ashbyhq.com/acme-robotics",
      jobBoardNavigationMode: "fetch",
    },
    {
      companyName: "Acme",
      profile: null,
      feedbackSummary: { promotedExamples: [], dismissedExamples: [] },
    },
    {
      discoverJobLinksFn: async () => [
        {
          url: "https://jobs.ashbyhq.com/acme-robotics/prefetched-1",
          text: "Backend Engineer",
          prefetched: {
            title: "Backend Engineer",
            descriptionHtml: "<p>Build APIs</p>",
            locationText: "Remote - Americas",
            externalId: "prefetched-1",
            salaryText: "$140K - $180K",
            workModel: "remote",
          },
        },
      ],
      classifyJobLeadFn: async () => ({
        decision: "review",
        score: 50,
        reason: "ok",
        matchedSignals: [],
        riskSignals: [],
        missingSignals: [],
      }),
      upsertJobLeadFn: (lead) => {
        persisted.push({
          salaryText: lead.salaryText,
          workModel: lead.workModel,
          locationText: lead.locationText,
          sourceName: lead.sourceName,
        });

        return {
          id: 1,
          created: true,
          promotedToApplicationId: null,
          leadSnapshot: snapshot({ sourceUrl: lead.sourceUrl, title: lead.title }),
        };
      },
    },
  );

  assert.deepEqual(persisted, [
    {
      salaryText: "$140K - $180K",
      workModel: "remote",
      locationText: "Remote - Americas",
      sourceName: "ashby",
    },
  ]);
});
