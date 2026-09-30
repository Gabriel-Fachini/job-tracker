import {
  extractDomain,
  isMatchableDomain,
  normalizeCompanyName,
  normalizeWebsiteOrigin,
} from "./normalize";

export type IndexedCompany = { id: number; name: string; website: string | null };

/**
 * In-memory lookup of companies by normalized name and by site domain, used to
 * decide whether a vacancy from an aggregated feed belongs to a known company.
 * Pure: the database wrapper lives in `resolve.ts`.
 */
export class CompanyIndex {
  private readonly byName = new Map<string, number>();
  private readonly byDomain = new Map<string, number>();

  constructor(companies: IndexedCompany[] = []) {
    for (const company of companies) {
      this.add(company);
    }
  }

  add(company: IndexedCompany) {
    const name = normalizeCompanyName(company.name);

    if (name && !this.byName.has(name)) {
      this.byName.set(name, company.id);
    }

    const domain = extractDomain(company.website);

    if (isMatchableDomain(domain) && !this.byDomain.has(domain)) {
      this.byDomain.set(domain, company.id);
    }
  }

  /** Domain wins over name: "Acme Inc" and "Acme Labs" can share a site, and a name can repeat across sites. */
  find(candidate: { name: string; website?: string | null }): number | null {
    const domain = extractDomain(candidate.website);

    if (isMatchableDomain(domain)) {
      const byDomain = this.byDomain.get(domain);

      if (byDomain !== undefined) {
        return byDomain;
      }
    }

    const byName = this.byName.get(normalizeCompanyName(candidate.name));

    return byName ?? null;
  }

  /** Finds the company or creates it through `create`, keeping the index current. */
  resolve(
    candidate: { name: string; website?: string | null },
    create: (input: { name: string; website: string | null }) => number,
  ): { id: number; created: boolean } {
    const existing = this.find(candidate);

    if (existing !== null) {
      return { id: existing, created: false };
    }

    const website = normalizeWebsiteOrigin(candidate.website);
    const id = create({ name: candidate.name.trim(), website });

    this.add({ id, name: candidate.name, website });

    return { id, created: true };
  }
}
