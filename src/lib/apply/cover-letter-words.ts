/** Word count, client-safe (the cover letter module imports server-only AI clients). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
