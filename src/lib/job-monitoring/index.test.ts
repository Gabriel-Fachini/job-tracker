import test from "node:test";
import assert from "node:assert/strict";

import type { LeadListItem } from "@/components/leads/types";
import { runMonitoringForCompany } from "./index";

function createMockLeadSnapshot(lead: { sourceUrl: string; title: string }): LeadListItem {
  return {
    id: 1,
    title: lead.title,
    sourceUrl: lead.sourceUrl,
    sourceName: "company_site",
    sourceKind: null,
    applyUrl: null,
    description: null,
    workModel: "remote",
    seniority: "senior",
    locationText: null,
    salaryText: null,
    classificationStatus: "interesting",
    classificationScore: 88,
    classificationReason: "Test",
    userDecision: "none",
    promotedToApplicationId: null,
    discoveredAt: new Date(),
    updatedAt: new Date(),
    companyId: 1,
    companyName: "Test Company",
  };
}

test("runMonitoringForCompany aggregates discoveries and persists discarded jobs without counting them as leads", async () => {
  const persisted: Array<{ sourceUrl: string; classificationStatus: string }> = [];

  const summary = await runMonitoringForCompany(
    {
      id: 1,
      name: "Acme",
      jobsBoardUrl: "https://example.com/careers",
      jobBoardNavigationMode: "fetch",
    },
    {
      companyName: "Acme",
      profile: null,
      feedbackSummary: {
        promotedExamples: [],
        dismissedExamples: [],
      },
    },
    {
      discoverJobLinksFn: async () => [
        { url: "https://example.com/jobs/frontend", text: "Frontend" },
        { url: "https://example.com/jobs/platform", text: "Platform" },
      ],
      extractJobDetailFn: async (url) => ({
        title: url.includes("frontend") ? "Frontend Engineer" : "Platform Engineer",
        description: "Descricao da vaga",
        sourceUrl: url,
        sourceName: "company_site",
        workModel: "remote",
        seniority: "senior",
        locationText: null,
        salaryText: null,
      }),
      classifyJobLeadFn: async (job) =>
        job.sourceUrl.includes("frontend")
          ? {
              decision: "interesting",
              score: 88,
              reason: "Bom encaixe com stack e senioridade.",
              matchedSignals: ["Stack em comum: React"],
              riskSignals: [],
              missingSignals: [],
            }
          : {
              decision: "discarded",
              score: 18,
              reason: "Desalinhada com foco atual.",
              matchedSignals: [],
              riskSignals: ["Fora do foco tecnico atual"],
              missingSignals: [],
            },
      upsertJobLeadFn: (lead) => {
        persisted.push({
          sourceUrl: lead.sourceUrl,
          classificationStatus: lead.classificationStatus,
        });

        return {
          id: persisted.length,
          created: true,
          promotedToApplicationId: null,
          leadSnapshot: createMockLeadSnapshot({ sourceUrl: lead.sourceUrl, title: lead.title }),
        };
      },
    },
  );

  assert.deepEqual(summary, {
    linksFound: 2,
    skippedLinks: 0,
    jobsParsed: 1,
    leadsSaved: 1,
    reviewsSaved: 0,
    discarded: 1,
    failed: 0,
  });
  assert.deepEqual(persisted, [
    {
      sourceUrl: "https://example.com/jobs/frontend",
      classificationStatus: "interesting",
    },
    // Discarded leads are persisted too: they are what later runs skip.
    {
      sourceUrl: "https://example.com/jobs/platform",
      classificationStatus: "discarded",
    },
  ]);
});

test("runMonitoringForCompany skips classification failures without persisting broken leads", async () => {
  const persisted: string[] = [];

  const summary = await runMonitoringForCompany(
    {
      id: 1,
      name: "Acme",
      jobsBoardUrl: "https://example.com/careers",
      jobBoardNavigationMode: "fetch",
    },
    {
      companyName: "Acme",
      profile: null,
      feedbackSummary: {
        promotedExamples: [],
        dismissedExamples: [],
      },
    },
    {
      discoverJobLinksFn: async () => [
        { url: "https://example.com/jobs/frontend", text: "Frontend" },
      ],
      extractJobDetailFn: async () => ({
        title: "Frontend Engineer",
        description: "Descricao da vaga",
        sourceUrl: "https://example.com/jobs/frontend",
        sourceName: "company_site",
        workModel: "remote",
        seniority: "senior",
        locationText: null,
        salaryText: null,
      }),
      classifyJobLeadFn: async () => {
        throw new Error("OLLAMA misconfigured");
      },
      upsertJobLeadFn: (lead) => {
        persisted.push(lead.sourceUrl);

        return {
          id: persisted.length,
          created: true,
          promotedToApplicationId: null,
          leadSnapshot: createMockLeadSnapshot({ sourceUrl: lead.sourceUrl, title: lead.title }),
        };
      },
    },
  );

  assert.deepEqual(summary, {
    linksFound: 1,
    skippedLinks: 0,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 1,
  });
  assert.deepEqual(persisted, []);
});

test("runMonitoringForCompany applies discovery hints before classification and persistence", async () => {
  let receivedWorkModel: string | null = null;
  let receivedSeniority: string | null = null;

  const summary = await runMonitoringForCompany(
    {
      id: 1,
      name: "Acme",
      jobsBoardUrl: "https://example.com/careers",
      jobBoardNavigationMode: "fetch",
    },
    {
      companyName: "Acme",
      profile: null,
      feedbackSummary: {
        promotedExamples: [],
        dismissedExamples: [],
      },
    },
    {
      discoverJobLinksFn: async () => [
        {
          url: "https://example.com/jobs/frontend",
          text: "Frontend Engineer Trabalho Remoto Senior",
        },
      ],
      extractJobDetailFn: async (url) => ({
        title: "Frontend Engineer",
        description: "Descricao da vaga",
        sourceUrl: url,
        sourceName: "company_site",
        workModel: null,
        seniority: null,
        locationText: null,
        salaryText: null,
      }),
      classifyJobLeadFn: async (job) => {
        receivedWorkModel = job.workModel;
        receivedSeniority = job.seniority;

        return {
          decision: "review",
          score: 54,
          reason: "Precisa de revisao manual.",
          matchedSignals: [],
          riskSignals: [],
          missingSignals: [],
        };
      },
      upsertJobLeadFn: (lead) => {
        assert.equal(lead.workModel, "remote");
        assert.equal(lead.seniority, "senior");

        return {
          id: 1,
          created: true,
          promotedToApplicationId: null,
          leadSnapshot: createMockLeadSnapshot({ sourceUrl: lead.sourceUrl, title: lead.title }),
        };
      },
    },
  );

  assert.equal(receivedWorkModel, "remote");
  assert.equal(receivedSeniority, "senior");
  assert.equal(summary.failed, 0);
});

test("runMonitoringForCompany leaves links alone once the run is aborted", async () => {
  const disconnect = new AbortController();
  const extracted: string[] = [];
  const persisted: string[] = [];

  const summary = await runMonitoringForCompany(
    {
      id: 1,
      name: "Acme",
      jobsBoardUrl: "https://example.com/careers",
      jobBoardNavigationMode: "fetch",
    },
    {
      companyName: "Acme",
      profile: null,
      feedbackSummary: {
        promotedExamples: [],
        dismissedExamples: [],
      },
    },
    {
      signal: disconnect.signal,
      discoverJobLinksFn: async () => {
        // The client disconnects while discovery runs.
        disconnect.abort();
        return [
          { url: "https://example.com/jobs/frontend", text: "Frontend" },
          { url: "https://example.com/jobs/platform", text: "Platform" },
        ];
      },
      extractJobDetailFn: async (url) => {
        extracted.push(url);
        return null;
      },
      upsertJobLeadFn: (lead) => {
        persisted.push(lead.sourceUrl);

        return {
          id: persisted.length,
          created: true,
          promotedToApplicationId: null,
          leadSnapshot: createMockLeadSnapshot({ sourceUrl: lead.sourceUrl, title: lead.title }),
        };
      },
    },
  );

  assert.deepEqual(extracted, []);
  assert.deepEqual(persisted, []);
  assert.equal(summary.linksFound, 2);
  assert.equal(summary.failed, 0);
});
