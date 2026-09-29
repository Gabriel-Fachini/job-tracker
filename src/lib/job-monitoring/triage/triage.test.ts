import assert from "node:assert/strict";
import test from "node:test";

import type { OpenAiResponsesClient } from "@/lib/ai/openai-runtime";
import type { ProfileSnapshot } from "@/lib/profile/editor";
import { normalizeSearchPreferences } from "@/lib/search-preferences";

import {
  assertTriageConfigured,
  createTriageEngine,
  getTriageEngineName,
  triageJob,
  TriageConfigurationError,
  TriageError,
} from "./index";
import { createJevEngine } from "./engines/jev";
import { createOllamaEngine, createOpenAiEngine } from "./engines/json-engine";
import { computeFit, evaluateStageOne, TRIAGE_THRESHOLDS } from "./rules";
import {
  buildCandidateProfile,
  buildEligibilityState,
  buildFitState,
  DEFAULT_STATE_TOKENS,
  estimateTokens,
  estimateYearsOfExperience,
  getStateTokenBudget,
  relevantSentences,
  seniorityFromYears,
} from "./state";
import { buildEligibilityQuestions, buildFitQuestions, MAX_OPTION_TEXT_CHARS } from "./questions";
import type {
  EligibilityAnswers,
  FitAnswers,
  TriageContext,
  TriageEngine,
  TriageJob,
} from "./types";

// ---- fixtures (fictional company and person) ---------------------------------------

const profile: ProfileSnapshot = {
  id: 1,
  fullName: "Ana Exemplo Silva",
  email: "ana.exemplo@example.test",
  phone: "+55 11 90000-0000",
  linkedin: "https://linkedin.example/in/ana-exemplo",
  github: "https://github.example/ana-exemplo",
  location: "Cidade Exemplo, BR",
  workModelPreference: "remote",
  companyTypePreference: "Product startups",
  valuesPreference: "Engineering culture, async work",
  notes: null,
  masterResumePath: null,
  updatedAt: new Date("2026-01-01"),
  experiences: [
    { company: "Acme Labs", role: "Backend Engineer", startDate: "2019-01", endDate: "2022-12", isCurrent: false, description: null, bullets: [] },
    { company: "Globex", role: "Senior Backend Engineer", startDate: "2023-01", endDate: null, isCurrent: true, description: null, bullets: [] },
  ],
  skills: [
    { name: "TypeScript", level: "expert", yearsExperience: 7, category: "language" },
    { name: "PostgreSQL", level: "advanced", yearsExperience: 6, category: "tool" },
  ],
  projects: [{ name: "Side Project", description: null, stack: ["Node.js", "Redis"], url: null, impact: null }],
  education: [],
};

const preferences = normalizeSearchPreferences({
  minMonthlyUsd: 5000,
  acceptedContracts: ["contractor", "eor", "pj"],
  acceptedEligibility: ["worldwide", "latam", "brazil"],
  timezone: "America/Sao_Paulo",
  maxUtcOffsetDistanceHours: 5,
  targetSeniorities: ["senior", "staff_plus"],
  targetJobFamilies: ["backend", "fullstack"],
  titleExcludeKeywords: ["intern", "sales"],
});

function context(overrides: Partial<TriageContext> = {}): TriageContext {
  return {
    companyName: "Initech Labs",
    profile,
    feedbackSummary: { promotedExamples: [], dismissedExamples: [] },
    preferences: { ...preferences, updatedAt: new Date() },
    ...overrides,
  };
}

function job(overrides: Partial<TriageJob> = {}): TriageJob {
  return {
    title: "Senior Backend Engineer",
    description: "Build APIs with TypeScript and PostgreSQL.\nWe hire contractors through Deel anywhere in the Americas.",
    sourceUrl: "https://jobs.example/backend",
    sourceName: "himalayas",
    workModel: "remote",
    seniority: null,
    locationText: "Remote (Americas)",
    salaryText: "USD 140,000-160,000 / year",
    companyName: "Initech Labs",
    ...overrides,
  };
}

function choice<T extends string>(value: T, confidence = 0.9) {
  return { value, confidence };
}

function eligibilityAnswers(overrides: Partial<EligibilityAnswers> = {}): EligibilityAnswers {
  return {
    eligibility: choice("americas_or_latam_incl_brazil", 0.91),
    usWorkAuthorizationRequired: 0.05,
    contract: choice("contractor_or_eor_ok"),
    timezone: choice("americas_overlap"),
    seniority: choice("senior"),
    jobFamily: choice("backend"),
    salarySpan: null,
    ...overrides,
  };
}

function fitAnswers(overrides: Partial<FitAnswers> = {}): FitAnswers {
  return {
    stackMatch: { value: 4.4, confidence: 0.9 },
    seniorityMatch: { value: 4.6, confidence: 0.9 },
    domainInterest: { value: 3.6, confidence: 0.8 },
    redFlags: 0.02,
    ...overrides,
  };
}

function fakeEngine(answers: { eligibility?: EligibilityAnswers; fit?: FitAnswers } = {}) {
  const calls = { eligibility: 0, fit: 0, inputs: [] as unknown[] };
  const engine: TriageEngine = {
    name: "openai",
    model: "test-model",
    async answerEligibility(input) {
      calls.eligibility += 1;
      calls.inputs.push(input);
      return answers.eligibility ?? eligibilityAnswers();
    },
    async answerFit(input) {
      calls.fit += 1;
      calls.inputs.push(input);
      return answers.fit ?? fitAnswers();
    },
  };

  return { engine, calls };
}

const throwingEngine: TriageEngine = {
  name: "openai",
  model: "never",
  async answerEligibility() {
    throw new Error("the model must not be called");
  },
  async answerFit() {
    throw new Error("the model must not be called");
  },
};

// ---- engine selection ------------------------------------------------------------------

test("TRIAGE_ENGINE defaults to openai and rejects unknown values", () => {
  assert.equal(getTriageEngineName({}), "openai");
  assert.equal(getTriageEngineName({ TRIAGE_ENGINE: "OpenAI" }), "openai");
  assert.equal(getTriageEngineName({ TRIAGE_ENGINE: "jev" }), "jev");
  assert.equal(getTriageEngineName({ TRIAGE_ENGINE: "ollama" }), "ollama");
  assert.throws(() => getTriageEngineName({ TRIAGE_ENGINE: "gpt" }), TriageConfigurationError);
});

test("engines fail closed when their key is missing", () => {
  assert.throws(() => assertTriageConfigured({}), /OPENAI_API_KEY/);
  assert.throws(() => assertTriageConfigured({ TRIAGE_ENGINE: "jev" }), (error: unknown) => {
    assert.ok(error instanceof TriageConfigurationError);
    assert.match(error.message, /TYPESAFE_API_KEY/);
    return true;
  });
  assert.doesNotThrow(() => assertTriageConfigured({ OPENAI_API_KEY: "k" }));
  assert.doesNotThrow(() => assertTriageConfigured({ TRIAGE_ENGINE: "jev", TYPESAFE_API_KEY: "k" }));

  const jev = createTriageEngine({ TRIAGE_ENGINE: "jev", TYPESAFE_API_KEY: "k" });
  assert.equal(jev.name, "jev");
  assert.equal(jev.model, "jev-1.13.0");

  const openai = createTriageEngine({ OPENAI_API_KEY: "k" });
  assert.equal(openai.name, "openai");
  assert.equal(openai.model, "gpt-6-luna");
  assert.equal(createTriageEngine({ OPENAI_API_KEY: "k", OPENAI_TRIAGE_MODEL: "custom" }).model, "custom");
});

// ---- states -----------------------------------------------------------------------------

test("relevantSentences keeps location, contract and pay sentences only", () => {
  const sentences = relevantSentences(
    "We love pizza. Candidates must be based in Brazil or Argentina.\n\nOur office has a ping-pong table. Contractors are paid via Deel.\nWe love pizza.",
    2000,
  );

  assert.deepEqual(sentences, [
    "Candidates must be based in Brazil or Argentina.",
    "Contractors are paid via Deel.",
  ]);
  assert.deepEqual(relevantSentences(null, 100), []);
  assert.equal(relevantSentences("Remote work. Remote work is great. Salary is fair.", 20).length, 1);
});

test("buildEligibilityState stays under the size cap and keeps the decisive text", () => {
  const filler = "This sentence talks about our benefits and remote culture in detail. ".repeat(2000);
  const state = buildEligibilityState(
    job({ description: `${filler}\nWe cannot sponsor visas.\n${filler}` }),
    [{ id: "c1", text: "$120k", context: "base salary $120k" }],
  );
  const serialized = JSON.stringify(state);

  assert.ok(estimateTokens(serialized) <= DEFAULT_STATE_TOKENS, `state has ~${estimateTokens(serialized)} tokens`);
  assert.equal(state.title, "Senior Backend Engineer");
  assert.deepEqual(state.salary_candidates, [{ id: "c1", text: "$120k", context: "base salary $120k" }]);
  assert.ok(Array.isArray(state.relevant_sentences));
  assert.ok((state.description_intro as string).length <= 1500);
});

test("TRIAGE_MAX_STATE_TOKENS shrinks the states to the configured budget (chars / 4)", () => {
  assert.equal(getStateTokenBudget({}), 6000);
  assert.equal(getStateTokenBudget({ TRIAGE_MAX_STATE_TOKENS: "1024" }), 1024);
  assert.equal(getStateTokenBudget({ TRIAGE_MAX_STATE_TOKENS: "abc" }), 6000);
  assert.equal(getStateTokenBudget({ TRIAGE_MAX_STATE_TOKENS: "-5" }), 6000);

  const filler = "We hire remote engineers and cover benefits, equipment and remote culture in detail. ".repeat(400);
  const description = `Intro paragraph about the team. ${filler}\nWe cannot sponsor visas for candidates outside the US.\n${filler}`;
  const candidates = [
    { id: "c1", text: "$120k", context: "base salary $120k per year" },
    { id: "c2", text: "$20k", context: "annual bonus $20k" },
  ];

  for (const maxTokens of [768, 1500, 4000]) {
    const eligibility = buildEligibilityState(job({ description }), candidates, { maxTokens });

    assert.ok(estimateTokens(JSON.stringify(eligibility)) <= maxTokens, `eligibility ${maxTokens}: ${estimateTokens(JSON.stringify(eligibility))}`);
    assert.equal(eligibility.title, "Senior Backend Engineer");

    const candidate = buildCandidateProfile(profile, preferences);
    const fit = buildFitState(job({ description }), "senior", "backend", {
      maxTokens,
      candidateChars: JSON.stringify(candidate).length,
    });

    // Jev reads job and candidate as one state.
    assert.ok(estimateTokens(JSON.stringify({ job: fit, candidate })) <= maxTokens, `fit ${maxTokens}`);
  }

  // A big budget keeps more of the description than a small one.
  const small = buildFitState(job({ description }), null, null, { maxTokens: 800 });
  const large = buildFitState(job({ description }), null, null, { maxTokens: 6000 });
  assert.ok((large.description as string).length > (small.description as string).length);
});

test("question options stay short so servers that cap option tokens keep them whole", () => {
  const eligibility = buildEligibilityQuestions({
    state: {},
    families: [],
    salaryCandidates: [{ id: "c1", text: "USD 120,000-150,000 / year", context: "x".repeat(300) }],
  });
  const fit = buildFitQuestions({ state: {}, candidate: {}, hasDomainPreference: true });
  const texts: string[] = [];

  for (const def of [...eligibility, ...fit]) {
    if (def.kind === "choice") texts.push(...Object.values(def.options));
    else if (def.kind === "noul") texts.push(def.criteria.true, def.criteria.false);
    else texts.push(...def.levels);
  }

  assert.ok(texts.length > 30);

  for (const text of texts) {
    assert.ok(text.length <= MAX_OPTION_TEXT_CHARS, `${text.length} chars: ${text.slice(0, 60)}`);
  }
});

test("the candidate profile sent to a model carries skills and levels, never personal data", () => {
  const candidate = buildCandidateProfile(profile, preferences, new Date("2026-06-01"));
  const serialized = JSON.stringify(candidate);

  for (const secret of ["Ana Exemplo", "ana.exemplo", "+55", "linkedin.example", "github.example", "Cidade Exemplo", "Acme Labs", "Globex"]) {
    assert.ok(!serialized.includes(secret), `leaked ${secret}`);
  }

  assert.equal(candidate.seniority, "senior");
  assert.ok((candidate.years_of_experience as number) >= 7);
  assert.deepEqual(candidate.target_job_families, ["backend", "fullstack"]);
  assert.deepEqual((candidate.skills as Array<{ name: string }>).map((skill) => skill.name), ["TypeScript", "PostgreSQL"]);
  assert.deepEqual(candidate.projects_stack, ["Node.js", "Redis"]);
  assert.equal(candidate.company_type_preference, "Product startups");
});

test("estimateYearsOfExperience merges overlaps and seniorityFromYears buckets", () => {
  const years = estimateYearsOfExperience(
    [
      { company: "A", role: "x", startDate: "2020-01", endDate: "2022-01", isCurrent: false, description: null, bullets: [] },
      { company: "B", role: "y", startDate: "2021-01", endDate: "2023-01", isCurrent: false, description: null, bullets: [] },
    ],
    new Date("2026-01-01"),
  );

  assert.equal(years, 3);
  assert.equal(seniorityFromYears(1), "junior");
  assert.equal(seniorityFromYears(3), "mid");
  assert.equal(seniorityFromYears(6), "senior");
  assert.equal(seniorityFromYears(12), "staff_plus");
});

// ---- stage 1 / stage 2 rules --------------------------------------------------------

test("stage 1: restricted eligibility discards only with high confidence", () => {
  const discarded = evaluateStageOne({
    answers: eligibilityAnswers({ eligibility: choice("us_only", 0.92) }),
    preferences,
    salaryFromSource: null,
    salaryCandidates: [],
  });
  assert.deepEqual(discarded.discard?.reason, "location_ineligible");

  const unsure = evaluateStageOne({
    answers: eligibilityAnswers({ eligibility: choice("us_only", 0.7) }),
    preferences,
    salaryFromSource: null,
    salaryCandidates: [],
  });
  assert.equal(unsure.discard, null);
  assert.match(unsure.forceReview.join(), /pouca confiança/);

  const notStated = evaluateStageOne({
    answers: eligibilityAnswers({ eligibility: choice("not_stated", 0.9) }),
    preferences,
    salaryFromSource: null,
    salaryCandidates: [],
  });
  assert.equal(notStated.discard, null);
  assert.match(notStated.forceReview.join(), /não informada/);
});

test("stage 1: employee_only with US authorization is a contract mismatch; contractor-only preferences too", () => {
  const usAuth = evaluateStageOne({
    answers: eligibilityAnswers({ contract: choice("employee_only", 0.9), usWorkAuthorizationRequired: 0.9 }),
    preferences,
    salaryFromSource: null,
    salaryCandidates: [],
  });
  assert.equal(usAuth.discard?.reason, "contract_mismatch");

  // 0.7 is not "above 0.7": the rule needs a strictly higher probability.
  const boundary = evaluateStageOne({
    answers: eligibilityAnswers({ contract: choice("employee_only", 0.9), usWorkAuthorizationRequired: 0.7 }),
    preferences: normalizeSearchPreferences({}),
    salaryFromSource: null,
    salaryCandidates: [],
  });
  assert.equal(boundary.discard, null);

  // The user accepts no employee contracts: employee_only fails even without the US question.
  const noEmployee = evaluateStageOne({
    answers: eligibilityAnswers({ contract: choice("employee_only", 0.9) }),
    preferences,
    salaryFromSource: null,
    salaryCandidates: [],
  });
  assert.equal(noEmployee.discard?.reason, "contract_mismatch");
});

test("stage 1: the salary the model picks is converted in code and compared with the floor", () => {
  const candidates = [
    { id: "c1", text: "$20,000", context: "bonus", parsed: { min: 20000, max: 20000, currency: "USD", period: null } },
    { id: "c2", text: "USD 3,000/month", context: "base", parsed: { min: 3000, max: 3000, currency: "USD", period: "month" as const } },
  ];

  const low = evaluateStageOne({
    answers: eligibilityAnswers({ salarySpan: choice("c2") }),
    preferences,
    salaryFromSource: null,
    salaryCandidates: candidates,
  });
  assert.equal(low.discard?.reason, "salary_below_min");
  assert.deepEqual(low.salary, { min: 36000, max: 36000 });
  assert.equal(low.salarySource, "model");

  // The source's own figure wins over anything the model picked.
  const fromSource = evaluateStageOne({
    answers: eligibilityAnswers({ salarySpan: choice("c2") }),
    preferences,
    salaryFromSource: { min: 100000, max: 120000 },
    salaryCandidates: candidates,
  });
  assert.equal(fromSource.discard, null);
  assert.equal(fromSource.salarySource, "source");
});

test("stage 1: seniority and family mismatches use adjacency and full-stack overlap", () => {
  const targets = normalizeSearchPreferences({ targetSeniorities: ["senior"], targetJobFamilies: ["backend"] });
  const check = (overrides: Partial<EligibilityAnswers>) =>
    evaluateStageOne({ answers: eligibilityAnswers(overrides), preferences: targets, salaryFromSource: null, salaryCandidates: [] });

  assert.equal(check({ seniority: choice("mid") }).discard, null);
  assert.equal(check({ seniority: choice("staff_plus") }).discard, null);
  assert.equal(check({ seniority: choice("junior", 0.9) }).discard?.reason, "seniority_mismatch");
  assert.equal(check({ seniority: choice("manager", 0.9) }).discard?.reason, "seniority_mismatch");
  assert.equal(check({ seniority: choice("junior", 0.5) }).discard, null);
  assert.equal(check({ seniority: choice("not_stated", 0.9) }).discard, null);

  assert.equal(check({ jobFamily: choice("fullstack") }).discard, null);
  assert.equal(check({ jobFamily: choice("data", 0.9) }).discard?.reason, "job_family_mismatch");
  assert.equal(check({ jobFamily: choice("other", 0.5) }).discard, null);
});

test("stage 2: composite score bands, weights and red flags", () => {
  const strong = computeFit(fitAnswers());
  // (0.85 * 0.45 + 0.9 * 0.30 + 0.65 * 0.25) * 100 = 81.5
  assert.equal(strong.score, 82);
  assert.equal(strong.decision, "interesting");

  const middling = computeFit(fitAnswers({ stackMatch: { value: 3, confidence: 0.9 }, seniorityMatch: { value: 3, confidence: 0.9 }, domainInterest: { value: 3, confidence: 0.9 } }));
  assert.equal(middling.score, 50);
  assert.equal(middling.decision, "review");

  const poor = computeFit(fitAnswers({ stackMatch: { value: 1.2, confidence: 0.9 }, seniorityMatch: { value: 1.5, confidence: 0.9 }, domainInterest: { value: 2, confidence: 0.9 } }));
  assert.equal(poor.decision, "discarded");
  assert.equal(poor.discardReason, "low_fit");

  // Without a domain preference the other weights are renormalized (0.6 / 0.4).
  const noDomain = computeFit(fitAnswers({ domainInterest: null, stackMatch: { value: 5, confidence: 0.9 }, seniorityMatch: { value: 1, confidence: 0.9 } }));
  assert.equal(noDomain.score, 60);
  assert.equal(noDomain.weights.domain, 0);

  const flagged = computeFit(fitAnswers({ redFlags: 0.6 }));
  assert.equal(flagged.score, 82 - TRIAGE_THRESHOLDS.redFlagScorePenalty);
  assert.equal(flagged.decision, "review");
  assert.equal(computeFit(fitAnswers({ redFlags: 0.9 })).decision, "discarded");
});

test("stage 2: a decisive answer with low confidence, or an open stage 1 question, forces review", () => {
  const unsureInteresting = computeFit(fitAnswers({ stackMatch: { value: 5, confidence: 0.4 }, seniorityMatch: { value: 5, confidence: 0.9 } }));
  assert.equal(unsureInteresting.decision, "review");
  assert.equal(unsureInteresting.discardReason, null);

  const unsureDiscard = computeFit(fitAnswers({ stackMatch: { value: 1, confidence: 0.4 }, seniorityMatch: { value: 1, confidence: 0.9 }, domainInterest: { value: 1, confidence: 0.9 } }));
  assert.equal(unsureDiscard.decision, "review");

  const openQuestion = computeFit(fitAnswers(), ["elegibilidade não informada"]);
  assert.equal(openQuestion.decision, "review");
  assert.deepEqual(openQuestion.forceReview, ["elegibilidade não informada"]);
});

// ---- triageJob (end to end with a fake engine) ---------------------------------------

test("stage 0 discards without calling any model and stores the rule as the engine", async () => {
  const result = await triageJob(
    job({ title: "Sales Manager", description: "This role is US only." }),
    context(),
    { engine: throwingEngine },
  );

  assert.equal(result.classification.decision, "discarded");
  assert.equal(result.classification.score, 0);
  assert.equal(result.fields.triageEngine, "rules");
  assert.equal(result.fields.discardReason, "job_family_mismatch");
  assert.equal(result.fields.triageConfidence, 1);
  assert.match(result.classification.reason, /área da vaga fora do alvo/);

  const usOnly = await triageJob(job({ description: "You must be located in the United States." }), context(), { engine: throwingEngine });
  assert.equal(usOnly.fields.discardReason, "location_ineligible");
  assert.equal(usOnly.fields.triageEngine, "rules");
});

test("without a saved profile nothing after stage 0 calls a model (review, 40)", async () => {
  const result = await triageJob(job(), context({ profile: null }), { engine: throwingEngine });

  assert.equal(result.classification.decision, "review");
  assert.equal(result.classification.score, 40);
  assert.equal(result.fields.triageEngine, "rules");
});

test("Remote (Americas), contractor, US$ 140k becomes interesting with a readable reason", async () => {
  const { engine, calls } = fakeEngine();
  const result = await triageJob(job(), context(), { engine });

  assert.equal(calls.eligibility, 1);
  assert.equal(calls.fit, 1);
  assert.equal(result.classification.decision, "interesting");
  assert.equal(result.classification.score, 82);
  assert.equal(
    result.classification.reason,
    "Elegível: Américas/LATAM (0,91) · contractor ok · sênior · stack forte (4,4/5) · US$ 140–160 mil/ano.",
  );
  assert.equal(result.fields.eligibility, "americas_or_latam_incl_brazil");
  assert.deepEqual(result.fields.contractTypes, ["contractor", "eor"]);
  assert.equal(result.fields.salaryMinUsdAnnual, 140000);
  assert.equal(result.fields.salaryMaxUsdAnnual, 160000);
  assert.equal(result.fields.triageEngine, "openai");
  assert.equal(result.fields.triageModel, "test-model");
  assert.equal(result.fields.discardReason, null);
  assert.equal(result.fields.triageConfidence, 0.8); // the lowest confidence behind the decision (domain interest)
  assert.ok(result.fields.triageDetails && (result.fields.triageDetails as { stage: number }).stage === 2);
  assert.ok(result.classification.matchedSignals.includes("Aceita contractor/EOR"));
});

test("triage sends the model only job text and profile facts, never personal data", async () => {
  const { engine, calls } = fakeEngine();

  await triageJob(job(), context(), { engine });

  const serialized = JSON.stringify(calls.inputs);

  for (const secret of ["Ana Exemplo", "ana.exemplo", "+55", "linkedin.example", "github.example", "Cidade Exemplo"]) {
    assert.ok(!serialized.includes(secret), `leaked ${secret}`);
  }
});

test("stage 1 discards (eligibility) skip stage 2 and keep the engine that decided", async () => {
  const { engine, calls } = fakeEngine({ eligibility: eligibilityAnswers({ eligibility: choice("europe_uk_only", 0.95) }) });
  const result = await triageJob(job({ locationText: "Remote", description: "Work remotely." }), context(), { engine });

  assert.equal(calls.fit, 0);
  assert.equal(result.classification.decision, "discarded");
  assert.equal(result.fields.discardReason, "location_ineligible");
  assert.equal(result.fields.triageEngine, "openai");
  assert.match(result.classification.reason, /Restrita: só Europa\/Reino Unido/);
});

test("eligibility not stated caps the lead at review even with a great fit", async () => {
  const { engine } = fakeEngine({ eligibility: eligibilityAnswers({ eligibility: choice("not_stated", 0.9) }) });
  const result = await triageJob(job({ locationText: "Remote", description: "Work remotely." }), context(), { engine });

  assert.equal(result.classification.decision, "review");
  assert.match(result.classification.reason, /Elegibilidade não informada/);
  assert.match(result.classification.reason, /revisar: elegibilidade não informada/);
});

test("with no preferences saved the hard filters are off and the model decides", async () => {
  const { engine } = fakeEngine();
  const result = await triageJob(
    job({ title: "Sales Manager", description: "US only." }),
    context({ preferences: null }),
    { engine },
  );

  assert.notEqual(result.fields.triageEngine, "rules");
});

test("the salary question is only asked when the source states no USD figure", async () => {
  const { engine, calls } = fakeEngine();

  await triageJob(job(), context(), { engine });
  await triageJob(
    job({ salaryText: null, description: "Base salary: $120k-$150k. Bonus of $20,000. Remote in the Americas." }),
    context(),
    { engine },
  );

  const [withSource, withoutSource] = [calls.inputs[0], calls.inputs[2]] as Array<{ salaryCandidates: unknown[] }>;

  assert.equal(withSource.salaryCandidates.length, 0);
  assert.equal(withoutSource.salaryCandidates.length, 2);
});

test("engine failures surface as TriageError so the pipeline counts the lead as failed", async () => {
  const failing: TriageEngine = {
    ...throwingEngine,
    async answerEligibility() {
      throw new Error("HTTP 500");
    },
  };

  await assert.rejects(triageJob(job(), context(), { engine: failing }), (error: unknown) => {
    assert.ok(error instanceof TriageError);
    assert.match((error as Error).message, /HTTP 500/);
    return true;
  });
});

// ---- concrete engines ---------------------------------------------------------------------

function openAiReplyFor(request: Record<string, unknown>) {
  const format = (request.text as { format: { schema: { properties: Record<string, unknown> } } }).format;
  const ids = Object.keys(format.schema.properties);
  const reply: Record<string, unknown> = {};

  for (const id of ids) {
    if (id === "eligibility") reply[id] = { value: "brazil_explicit", confidence: "high" };
    else if (id === "us_work_authorization_required") reply[id] = { answer: "no", confidence: "high" };
    else if (id === "contract") reply[id] = { value: "contractor_or_eor_ok", confidence: "medium" };
    else if (id === "timezone") reply[id] = { value: "americas_overlap", confidence: "high" };
    else if (id === "seniority") reply[id] = { value: "senior", confidence: "high" };
    else if (id === "job_family") reply[id] = { value: "backend", confidence: "high" };
    else if (id === "salary_span") reply[id] = { value: "c1", confidence: "medium" };
    else if (id === "stack_match") reply[id] = { level: 5, confidence: "high" };
    else if (id === "seniority_match") reply[id] = { level: 4, confidence: "medium" };
    else if (id === "domain_interest") reply[id] = { level: 3, confidence: "low" };
    else if (id === "red_flags") reply[id] = { answer: "yes", confidence: "medium" };
  }

  return JSON.stringify(reply);
}

test("the OpenAI engine sends a strict schema with the triage model and maps confidence labels", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const client: OpenAiResponsesClient = {
    responses: {
      create: async (params) => {
        requests.push(params);
        return { output_text: openAiReplyFor(params), usage: { input_tokens: 500, output_tokens: 60 } };
      },
    },
  };
  const engine = createOpenAiEngine({ client });
  const candidates = [{ id: "c1", text: "$120k", context: "base pay $120k" }];

  const eligibility = await engine.answerEligibility({
    state: { title: "Backend Engineer" },
    families: ["backend"],
    salaryCandidates: candidates,
  });

  assert.equal(requests[0].model, "gpt-6-luna");
  const format = (requests[0].text as { format: { type: string; strict: boolean; schema: { required: string[]; additionalProperties: boolean; properties: Record<string, { properties: { value?: { enum: string[] } } }> } } }).format;
  assert.equal(format.type, "json_schema");
  assert.equal(format.strict, true);
  assert.equal(format.schema.additionalProperties, false);
  assert.deepEqual(format.schema.required, ["eligibility", "us_work_authorization_required", "contract", "timezone", "seniority", "job_family", "salary_span"]);
  assert.deepEqual(format.schema.properties.job_family.properties.value?.enum, ["backend", "other"]);
  assert.deepEqual(format.schema.properties.salary_span.properties.value?.enum, ["c1", "none"]);

  const input = (requests[0].input as Array<{ role: string; content: string }>)[1].content;
  assert.match(input, /untrusted|"state"/);
  assert.match((requests[0].input as Array<{ content: string }>)[0].content, /untrusted data/);

  assert.deepEqual(eligibility.eligibility, { value: "brazil_explicit", confidence: 0.9 });
  assert.equal(eligibility.contract.confidence, 0.7);
  assert.equal(eligibility.usWorkAuthorizationRequired, 1 - 0.9);
  assert.deepEqual(eligibility.salarySpan, { value: "c1", confidence: 0.7 });
  assert.equal(eligibility.jobFamily.value, "backend");

  const fit = await engine.answerFit({ state: { title: "x" }, candidate: { skills: [] }, hasDomainPreference: true });

  assert.deepEqual(fit.stackMatch, { value: 5, confidence: 0.9 });
  assert.deepEqual(fit.seniorityMatch, { value: 4, confidence: 0.7 });
  assert.deepEqual(fit.domainInterest, { value: 3, confidence: 0.4 });
  assert.equal(fit.redFlags, 0.7);

  // Without a domain preference the question is not sent.
  await engine.answerFit({ state: {}, candidate: {}, hasDomainPreference: false });
  const lastSchema = (requests[2].text as { format: { schema: { required: string[] } } }).format.schema;
  assert.deepEqual(lastSchema.required, ["stack_match", "seniority_match", "red_flags"]);
});

test("JSON engines fall back to not_stated / neutral answers with zero confidence on bad output", async () => {
  const engine = createOllamaEngine({
    model: "local-model",
    call: async () => '```json\n{"eligibility": {"value": "mars", "confidence": "high"}, "contract": {"value": "employee_only", "confidence": "high"}}\n```',
  });

  const answers = await engine.answerEligibility({ state: {}, families: [], salaryCandidates: [] });

  assert.equal(engine.name, "ollama");
  assert.deepEqual(answers.eligibility, { value: "not_stated", confidence: 0 });
  assert.deepEqual(answers.contract, { value: "employee_only", confidence: 0.9 });
  assert.equal(answers.usWorkAuthorizationRequired, 0.5);
  assert.equal(answers.salarySpan, null);

  const broken = createOllamaEngine({ model: "m", call: async () => "not json at all" });
  await assert.rejects(broken.answerFit({ state: {}, candidate: {}, hasDomainPreference: false }), /JSON inválido/);
});

test("the Jev engine sends every stage question in one call and maps probabilities and scores", async () => {
  const requests: Array<{ body: { state: unknown; model: string; questions: Record<string, { type: string }> } }> = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push({ body });
    const answers: Record<string, unknown> = {};

    for (const [id, question] of Object.entries(body.questions as Record<string, { type: string }>)) {
      if (question.type === "choice") {
        answers[id] = {
          type: "choice",
          choice: id === "eligibility" ? "worldwide" : id === "seniority" ? "senior" : id === "job_family" ? "backend" : id === "contract" ? "contractor_or_eor_ok" : "not_stated",
          probabilities: { worldwide: 0.9 },
          confidence: 0.93,
        };
      } else if (question.type === "noul") {
        answers[id] = { type: "noul", noul: id === "red_flags" ? 0.02 : 0.1 };
      } else {
        answers[id] = { type: "score", score: 3.2, legend: {}, probabilities: {}, confidence: 0.85 };
      }
    }

    return new Response(JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens: 1200, output_tokens: 90 } }), { status: 200 });
  }) as typeof fetch;

  const engine = createJevEngine({ config: { apiKey: "k", model: "jev-1.13.0", endpoint: "https://api.typesafe.ai/v1/systemone", timeoutMs: 1000 }, fetchImpl });
  const eligibility = await engine.answerEligibility({ state: { title: "x" }, families: ["backend"], salaryCandidates: [] });

  assert.equal(requests.length, 1);
  assert.deepEqual(Object.keys(requests[0].body.questions), ["eligibility", "us_work_authorization_required", "contract", "timezone", "seniority", "job_family"]);
  assert.deepEqual(eligibility.eligibility, { value: "worldwide", confidence: 0.93, probabilities: { worldwide: 0.9 } });
  assert.equal(eligibility.usWorkAuthorizationRequired, 0.1);
  assert.equal(eligibility.contract.value, "contractor_or_eor_ok");

  const fit = await engine.answerFit({ state: { title: "x" }, candidate: { skills: [] }, hasDomainPreference: true });

  assert.equal(requests.length, 2);
  assert.deepEqual(Object.keys(requests[1].body.questions), ["stack_match", "seniority_match", "domain_interest", "red_flags"]);
  // Jev scores are 0-based; the rules use 1-5.
  assert.deepEqual(fit.stackMatch, { value: 4.2, confidence: 0.85 });
  assert.equal(fit.redFlags, 0.02);
  assert.deepEqual(requests[1].body.state, { job: { title: "x" }, candidate: { skills: [] } });
});
