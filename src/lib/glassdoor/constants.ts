/** Job titles the Glassdoor screens treat as technology roles. */
export const TECH_TITLE_PATTERN =
  /(desenvolv|engenh|software|developer|engineer|\bdev\b|full ?stack|back ?-?end|front ?-?end|tech ?lead|\bsre\b|devops|dados|data|\bqa\b|quality|mobile|arquitet|cloud|infra|seguran|infosec|cyber)/i;

export function isTechTitle(title: string | null | undefined): boolean {
  return TECH_TITLE_PATTERN.test(title ?? "");
}
