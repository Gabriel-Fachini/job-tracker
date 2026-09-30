import { getProfileSnapshot } from "@/lib/profile/queries";
import { getSearchPreferences } from "@/lib/search-preferences-queries";

import { getRecentLeadFeedbackSummary } from "./feedback";
import { assertTriageConfigured } from "./triage";
import type { ClassificationContext } from "./types";

/**
 * Profile, recent feedback and search preferences for one run. Fails first when
 * the triage engine is not configured (`TRIAGE_ENGINE=jev` without a key,
 * `openai` without `OPENAI_API_KEY`...), so the run stops once, with a clear
 * message, instead of failing every vacancy. Lives outside the `"use server"`
 * files on purpose: exported actions are callable from the browser.
 */
export async function loadRunContext(): Promise<Omit<ClassificationContext, "companyName">> {
  assertTriageConfigured();

  return {
    profile: await getProfileSnapshot(),
    feedbackSummary: getRecentLeadFeedbackSummary(),
    preferences: getSearchPreferences(),
  };
}
