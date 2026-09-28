"use server";

import { revalidatePath } from "next/cache";

import { getRecentLeadFeedbackSummary } from "@/lib/job-monitoring/feedback";
import { runMonitoringForSource } from "@/lib/job-monitoring/source-run";
import {
  getEnabledSources,
  getSourceById,
  setSourceEnabled,
  type JobSourceRecord,
} from "@/lib/job-monitoring/sources/store";
import type { MonitoringSummary } from "@/lib/job-monitoring/types";
import { getProfileSnapshot } from "@/lib/profile/queries";
import type { MonitoringActionResult } from "@/server/actions/job-monitoring";

function emptySummary(): MonitoringSummary {
  return {
    linksFound: 0,
    skippedLinks: 0,
    jobsParsed: 0,
    leadsSaved: 0,
    reviewsSaved: 0,
    discarded: 0,
    failed: 0,
  };
}

function toRunnable(source: JobSourceRecord) {
  return {
    id: source.id,
    kind: source.kind,
    name: source.name,
    config: source.config,
    cursor: source.lastCursor,
  };
}

function revalidateSourceViews() {
  revalidatePath("/leads");
  revalidatePath("/leads/sources");
  revalidatePath("/companies");
}

export async function setSourceEnabledAction(
  sourceId: number,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  if (!Number.isInteger(sourceId)) {
    return { ok: false };
  }

  const ok = setSourceEnabled(sourceId, Boolean(enabled));

  revalidatePath("/leads/sources");

  return { ok };
}

async function runSources(sources: JobSourceRecord[], label: string): Promise<MonitoringActionResult> {
  const summary = emptySummary();
  const errors: string[] = [];
  const context = {
    profile: await getProfileSnapshot(),
    feedbackSummary: getRecentLeadFeedbackSummary(),
  };

  // Sequential: the feeds are public and small; being polite matters more than speed.
  for (const source of sources) {
    try {
      const result = await runMonitoringForSource(toRunnable(source), context);

      summary.linksFound += result.linksFound;
      summary.skippedLinks += result.skippedLinks;
      summary.jobsParsed += result.jobsParsed;
      summary.leadsSaved += result.leadsSaved;
      summary.reviewsSaved += result.reviewsSaved;
      summary.discarded += result.discarded;
      summary.failed += result.failed;
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  revalidateSourceViews();

  return {
    success: errors.length === 0,
    label,
    ...summary,
    ...(errors.length > 0 ? { error: errors.join(" | ") } : {}),
  };
}

/** Runs every enabled source (no SSE, no run-state; the radar button on /leads also runs them). */
export async function runSourcesMonitoring(): Promise<MonitoringActionResult> {
  return runSources(getEnabledSources(), "fontes agregadas");
}

/** Runs one source, enabled or not (the "Rodar" button of its row). */
export async function runSourceMonitoring(sourceId: number): Promise<MonitoringActionResult> {
  const source = Number.isInteger(sourceId) ? getSourceById(sourceId) : null;

  if (!source) {
    return { success: false, label: "Fonte", ...emptySummary(), error: "Fonte não encontrada." };
  }

  return runSources([source], source.name);
}
