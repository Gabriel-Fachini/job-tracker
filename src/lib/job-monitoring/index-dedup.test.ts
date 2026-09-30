import assert from "node:assert/strict";
import test from "node:test";

import type { LeadListItem } from "@/components/leads/types";
import { buildDedupKey } from "@/lib/companies/normalize";

import { runMonitoringForCompany } from "./index";
import type { PersistableLead } from "./types";

const context = {
  companyName: "Acme Robotics",
  profile: null,
  feedbackSummary: { promotedExamples: [], dismissedExamples: [] },
};

const company = {
  id: 1,
  name: "Acme Robotics",
  jobsBoardUrl: "https://jobs.ashbyhq.com/acme-robotics",
  jobBoardNavigationMode: "fetch" as const,
};

function link(n: number, title: string) {
  return {
    url: `https://jobs.ashbyhq.com/acme-robotics/dedup-${n}`,
    text: title,
    prefetched: {
      title,
      descriptionHtml: "<p>desc</p>",
      externalId: `ext-${n}`,
      applyUrl: `https://jobs.ashbyhq.com/acme-robotics/dedup-${n}/application`,
    },
  };
}

test("company pipeline merges a vacancy an aggregator already reported into the ATS link", async () => {
  const adopted: Array<{ leadId: number; sourceUrl: string; sourceName: string; applyUrl: string | null }> = [];
  const persisted: PersistableLead[] = [];
  const events: string[] = [];

  const summary = await runMonitoringForCompany(company, context, {
    discoverJobLinksFn: async () => [
      link(1, "Senior Backend Engineer"),
      link(2, "Platform Engineer"),
      // Two ATS postings with the same title stay separate: only aggregator leads are merged.
      link(3, "Platform Engineer"),
    ],
    findLeadByDedupKeyFn: (key) =>
      key === buildDedupKey("Acme Robotics", "Senior Backend Engineer")
        ? { id: 42, companyId: 1, sourceKind: "himalayas", sourceUrl: "https://himalayas.example/jobs/1" }
        : key === buildDedupKey("Acme Robotics", "Platform Engineer")
          ? { id: 43, companyId: 1, sourceKind: "company", sourceUrl: "https://jobs.ashbyhq.com/acme-robotics/older" }
          : null,
    adoptAtsLinkFn: (leadId, ats) => {
      adopted.push({ leadId, ...ats });
      return true;
    },
    classifyJobLeadFn: async () => ({
      decision: "review",
      score: 50,
      reason: "ok",
      matchedSignals: [],
      riskSignals: [],
      missingSignals: [],
    }),
    upsertJobLeadFn: (lead) => {
      persisted.push(lead);

      return {
        id: persisted.length,
        created: true,
        promotedToApplicationId: null,
        leadSnapshot: { id: 1, title: lead.title, companyName: "Acme" } as unknown as LeadListItem,
      };
    },
    onEvent: (event) => events.push(event.type),
  });

  assert.equal(adopted.length, 1);
  assert.deepEqual(adopted[0], {
    leadId: 42,
    sourceUrl: "https://jobs.ashbyhq.com/acme-robotics/dedup-1",
    sourceName: "ashby",
    applyUrl: "https://jobs.ashbyhq.com/acme-robotics/dedup-1/application",
    externalId: "ext-1",
  });
  assert.equal(summary.skippedLinks, 1);
  assert.equal(summary.leadsSaved, 2);
  assert.deepEqual(
    persisted.map((lead) => lead.title).sort(),
    ["Platform Engineer", "Platform Engineer"],
  );
  assert.ok(events.includes("link-skipped"));

  for (const lead of persisted) {
    assert.equal(lead.sourceKind, "company");
    assert.match(lead.dedupKey ?? "", /^[a-f0-9]{32}$/);
    assert.ok(lead.applyUrl?.endsWith("/application"));
  }
});
