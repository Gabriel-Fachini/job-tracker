import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { jobSources, type JobSource } from "@/lib/db/schema";

import { defaultSources } from "./catalog";
import { isSourceKind, type SourceConfig, type SourceKind } from "./types";

export type JobSourceRecord = {
  id: number;
  kind: SourceKind;
  name: string;
  config: SourceConfig;
  enabled: boolean;
  lastRunAt: Date | null;
  lastCursor: string | null;
  lastError: string | null;
};

function parseConfig(value: string | null): SourceConfig {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SourceConfig) : {};
  } catch {
    return {};
  }
}

function toRecord(row: JobSource): JobSourceRecord | null {
  if (!isSourceKind(row.kind)) {
    return null;
  }

  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    config: parseConfig(row.config),
    enabled: row.enabled,
    lastRunAt: row.lastRunAt,
    lastCursor: row.lastCursor,
    lastError: row.lastError,
  };
}

/** Inserts the built-in sources that are missing (enabled). Idempotent; safe to call on every read. */
export function ensureDefaultSources(): void {
  const existing = new Set(db.select({ kind: jobSources.kind }).from(jobSources).all().map((row) => row.kind));
  const now = new Date();

  for (const source of defaultSources) {
    if (!existing.has(source.kind)) {
      db.insert(jobSources)
        .values({ kind: source.kind, name: source.name, enabled: true, createdAt: now })
        .run();
    }
  }
}

export function listSources(): JobSourceRecord[] {
  ensureDefaultSources();

  return db
    .select()
    .from(jobSources)
    .orderBy(asc(jobSources.id))
    .all()
    .map(toRecord)
    .filter((record): record is JobSourceRecord => record !== null);
}

export function getEnabledSources(): JobSourceRecord[] {
  return listSources().filter((source) => source.enabled);
}

export function getSourceById(id: number): JobSourceRecord | null {
  ensureDefaultSources();

  const row = db.select().from(jobSources).where(eq(jobSources.id, id)).get();

  return row ? toRecord(row) : null;
}

export function setSourceEnabled(id: number, enabled: boolean): boolean {
  const { changes } = db.update(jobSources).set({ enabled }).where(eq(jobSources.id, id)).run();

  return changes > 0;
}

/** Stores the outcome of a run: the cursor only advances on success. */
export function recordSourceRun(
  id: number,
  outcome: { ok: true; cursor?: string | null } | { ok: false; error: string },
): void {
  const now = new Date();

  if (outcome.ok) {
    db.update(jobSources)
      .set({
        lastRunAt: now,
        lastError: null,
        ...(outcome.cursor !== undefined ? { lastCursor: outcome.cursor } : {}),
      })
      .where(eq(jobSources.id, id))
      .run();
    return;
  }

  db.update(jobSources)
    .set({ lastRunAt: now, lastError: outcome.error.slice(0, 500) })
    .where(eq(jobSources.id, id))
    .run();
}
