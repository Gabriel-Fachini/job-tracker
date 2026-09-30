/** Glassdoor employer id from an overview URL (`...-EI_IE<id>.13,20.htm` or `...-E<id>.htm`). */
export function parseGlassdoorId(url: string | null | undefined): number | null {
  if (!url) {
    return null;
  }

  const match = /E(?:I_IE)?(\d+)/.exec(url);

  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Lowercase, no accents, collapsed whitespace: the key names are matched by. */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Maps Glassdoor's headcount label to the app's company size, by upper bound. */
export function mapGlassdoorSize(
  label: string | null | undefined,
): "small" | "medium" | "large" | "enterprise" | null {
  if (!label) {
    return null;
  }

  const numbers = [...label.matchAll(/\d[\d.]*/g)]
    .map((match) => Number(match[0].replaceAll(".", "")))
    .filter((value) => Number.isFinite(value));

  if (numbers.length === 0) {
    return null;
  }

  const open = /mais de|\+/i.test(label);
  const upper = open ? Infinity : Math.max(...numbers);

  if (upper <= 200) return "small";
  if (upper <= 500) return "medium";
  if (upper <= 5000) return "large";
  return "enterprise";
}
