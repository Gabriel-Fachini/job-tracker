"use server";

import { revalidatePath } from "next/cache";

import {
  normalizeSearchPreferences,
  type SearchPreferencesInput,
} from "@/lib/search-preferences";
import { saveSearchPreferences } from "@/lib/search-preferences-queries";

export type SaveSearchPreferencesResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: "validation" };

export async function saveSearchPreferencesAction(
  input: SearchPreferencesInput,
): Promise<SaveSearchPreferencesResult> {
  const timezoneWasProvided =
    typeof input?.timezone === "string" && input.timezone.trim().length > 0;
  const normalized = normalizeSearchPreferences(input);

  // A typed time zone that Intl does not know is an error, not something to drop silently.
  if (timezoneWasProvided && normalized.timezone === null) {
    return { ok: false, error: "validation" };
  }

  const saved = saveSearchPreferences(normalized);

  revalidatePath("/profile");

  return { ok: true, updatedAt: (saved.updatedAt ?? new Date()).toISOString() };
}
