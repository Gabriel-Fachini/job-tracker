import type { SourceKind } from "./types";

/** Built-in sources, seeded on first read (`ensureDefaultSources`); the user can only toggle them. */
export const defaultSources: Array<{
  kind: SourceKind;
  name: string;
  /** Text credited on the lead ("via ..."), required by some feeds' terms. */
  attribution: string;
  homepage: string;
}> = [
  { kind: "himalayas", name: "Himalayas", attribution: "Himalayas", homepage: "https://himalayas.app" },
  { kind: "remoteok", name: "Remote OK", attribution: "Remote OK", homepage: "https://remoteok.com" },
  {
    kind: "weworkremotely",
    name: "We Work Remotely",
    attribution: "We Work Remotely",
    homepage: "https://weworkremotely.com",
  },
  { kind: "jobicy", name: "Jobicy", attribution: "Jobicy", homepage: "https://jobicy.com" },
  {
    kind: "hn_whoishiring",
    name: "HN: Who is hiring?",
    attribution: "Hacker News",
    homepage: "https://news.ycombinator.com",
  },
];

export function getSourceAttribution(kind: string | null | undefined): string | null {
  return defaultSources.find((source) => source.kind === kind)?.attribution ?? null;
}
