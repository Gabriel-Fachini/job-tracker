/** Small synthetic schema v1 payloads for tests. Never real Glassdoor text. */

type Overrides = Record<string, unknown>;

export function makeCompanyPayload(overrides: Overrides = {}) {
  return {
    employer: {
      glassdoor_id: 1234567,
      name: "Acme Sintética",
      overview_url:
        "https://www.glassdoor.com.br/Vis%C3%A3o-geral/Trabalhar-na-Acme-EI_IE1234567.13,20.htm",
      logo_url: "https://example.test/logo.png",
      website: "https://acme.example.test",
      headquarters: "Cidade Exemplo",
      size: "201 a 500 funcionários",
      revenue: "n/d",
      ownership: "n/d",
      year_founded: 2016,
      industry: "Software",
      sector: "Tecnologia",
    },
    ratings: {
      overall: 3.9,
      culture_values: 3.7,
      work_life_balance: 3.5,
      compensation_benefits: 3.9,
      career_opportunities: 3.8,
      senior_management: 3.6,
      diversity_inclusion: 3.7,
      recommend_to_friend: 0.68,
      ceo_approval: 0.9,
      business_outlook: 0.66,
      review_count: 3,
      ceo: { name: "Fulano", title: "CEO" },
      industry_benchmark: { overall: 3.7, recommend_to_friend: 0.65 },
      distribution: { overall: { _1: 1, _2: 0, _3: 0, _4: 1, _5: 1 } },
    },
    reviews: {
      total: 3,
      items: [
        review(1001, "2026-08-01T10:00:00.000", "Desenvolvedor Backend", 4),
        review(1002, "2025-03-10T10:00:00.000", "Analista Financeiro", 2),
        review(1003, "2024-01-05T10:00:00.000", "Engenheira de Dados", 5),
      ],
    },
    interviews: {
      total: 2,
      difficulty_avg: 2.5,
      experience_counts: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 0 },
      channel_counts: { APPLIED_ONLINE: 2 },
      items: [
        interview(2001, "2026-07-01T00:00:00", "Desenvolvedor Backend"),
        interview(2002, "2026-02-01T00:00:00", "Analista de RH"),
      ],
    },
    salaries: {
      job_title_count: 2,
      pay_period: "MONTHLY",
      location: "Brasil",
      items: [
        salary("Desenvolvedor", 10, 4000, 6000, 9000),
        salary("Analista Financeiro", 4, 3000, 4500, 6000),
      ],
    },
    warnings: [],
    ...overrides,
  };
}

function review(id: number, date: string, jobTitle: string, rating: number) {
  return {
    id,
    date,
    job_title: jobTitle,
    location: "Cidade Exemplo",
    employment_status: "REGULAR",
    is_current: id % 2 === 0,
    years_employed: 2,
    rating,
    sub_ratings: { culture_values: 3 },
    recommend: "POSITIVE",
    ceo: null,
    business_outlook: "POSITIVE",
    summary: `Resumo sintético ${id}`,
    pros: `Prós sintéticos ${id}`,
    cons: `Contras sintéticos ${id}`,
    advice: null,
    helpful: 0,
    has_employer_response: false,
  };
}

function interview(id: number, date: string, jobTitle: string) {
  return {
    id,
    date,
    job_title: jobTitle,
    location: "Brasil",
    difficulty: "AVERAGE",
    experience: "POSITIVE",
    outcome: "NO_OFFER",
    duration_days: 14,
    process: `Processo sintético ${id}`,
    questions: ["Pergunta sintética?"],
  };
}

function salary(jobTitle: string, count: number, p10: number, p50: number, p90: number) {
  const band = (mult: number) => ({
    p10: p10 * mult,
    p25: ((p10 + p50) / 2) * mult,
    p50: p50 * mult,
    p75: ((p50 + p90) / 2) * mult,
    p90: p90 * mult,
    p05: p10 * mult,
    p95: p90 * mult,
    p005: p10 * mult,
    p995: p90 * mult,
  });
  return {
    job_title: jobTitle,
    currency: "BRL",
    count,
    most_recent: "2026-08-10T11:08:47",
    base: band(1),
    total: band(1.2),
  };
}

export function makePayload(
  overrides: Overrides = {},
  company: Overrides = {},
) {
  return {
    schema_version: 1,
    source: "glassdoor",
    collected_at: "2026-09-28T12:00:00.000Z",
    since: null,
    errors: [],
    companies: [makeCompanyPayload(company)],
    ...overrides,
  };
}
