const CHAR_MAP: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

export function escapeLatex(input: string): string {
  return input.replace(/[\\&%$#_{}\^~]/g, (char) => CHAR_MAP[char] ?? char);
}

const UNSAFE_URL_CHARS = /[\\{}%]/;

export function isSafeUrl(url: string): boolean {
  try {
    new URL(url);
    return !UNSAFE_URL_CHARS.test(url);
  } catch {
    return false;
  }
}
