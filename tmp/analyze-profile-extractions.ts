import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Table from "cli-table3";
import pc from "picocolors";

const cwd = process.cwd();
const inputPath = path.join(cwd, "tmp", "profile-extraction-result.json");
const outputPath = path.join(cwd, "tmp", "profile-extraction-analysis.json");

type Provider = "local" | "openai";
type RunMode = "local-only" | "compare" | "openai-only";

type ProviderMetrics = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
  totalDurationMs: number | null;
};

type ExtractedProfile = {
  profile?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedin?: string | null;
    github?: string | null;
    location?: string | null;
    workModelPreference?: string | null;
    notes?: string | null;
    masterResumePath?: string | null;
  };
  experiences?: Array<{
    company?: string;
    role?: string;
    startDate?: string;
    endDate?: string | null;
    isCurrent?: boolean;
    description?: string | null;
    bullets?: Array<{
      content?: string;
      tags?: string[];
    }>;
  }>;
  skills?: Array<{
    name?: string;
    level?: string | null;
    yearsExperience?: number | null;
    category?: string | null;
  }>;
  projects?: Array<{
    name?: string;
  }>;
  education?: Array<{
    institution?: string;
    degree?: string | null;
    field?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
};

type StoredRunV2 = {
  runId: string;
  createdAt: string;
  sourcePdfPath: string;
  compareEnabled: boolean;
  runMode: RunMode;
  compareGroupId: string | null;
  provider: Provider;
  providerStatus: "success" | "skipped" | "error";
  model: string | null;
  output: ExtractedProfile | Record<string, unknown> | null;
  rawOutput: string | null;
  error: string | null;
  observations: string[];
  input: string;
  metrics: ProviderMetrics;
  validationError: string | null;
};

type StoredRunLegacy = {
  runId: string;
  createdAt: string;
  sourcePdfPath: string;
  compareEnabled: boolean;
  runMode: RunMode;
  input: string;
  local: {
    status: "success" | "skipped";
    model: string | null;
    output: ExtractedProfile | null;
  };
  openai: {
    status: "success" | "skipped" | "error";
    model: string | null;
    output: ExtractedProfile | null;
    rawOutput?: string | null;
    error?: string | null;
  };
  observations: string[];
  metrics: {
    local: ProviderMetrics;
    openai: ProviderMetrics;
  };
  validation?: {
    local: string | null;
    openai: string | null;
  };
};

type StoredRunHistory = {
  version: 1;
  runs: Array<StoredRunV2 | StoredRunLegacy>;
};

type AnalysisRun = {
  runId: string;
  createdAt: string;
  provider: Provider;
  providerStatus: StoredRunV2["providerStatus"];
  model: string | null;
  runMode: RunMode;
  compareEnabled: boolean;
  compareGroupId: string | null;
  sourcePdfPath: string;
  coverage: {
    profileFieldsFilled: number;
    profileFieldsTotal: number;
    experiences: number;
    totalBullets: number;
    skills: number;
    education: number;
    projects: number;
  };
  quality: {
    descriptionsPresent: number;
    skillLevelsFilled: number;
    yearsExperienceFilled: number;
    zeroYearsExperience: number;
    suspiciousSkills: string[];
    suspiciousLinks: string[];
    nullRate: number;
  };
  score: {
    coverage: number;
    precisionHeuristic: number;
    utility: number;
    overall: number;
  };
  metrics: ProviderMetrics;
  validationError: string | null;
  error: string | null;
  observations: string[];
};

type AggregateSummary = {
  providers: Record<
    Provider,
    {
      runs: number;
      successfulRuns: number;
      avgOverall: number;
      avgCoverage: number;
      avgCostUsd: number | null;
    }
  >;
  models: Array<{
    provider: Provider;
    model: string;
    runs: number;
    successfulRuns: number;
    avgOverall: number;
    avgCoverage: number;
    avgCostUsd: number | null;
    schemaFailures: number;
    providerErrors: number;
  }>;
};

async function main() {
  const history = await loadHistory();
  const normalizedRuns = history.runs.flatMap(normalizeStoredRun);
  const analyses = normalizedRuns.map(analyzeRun);

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceFile: inputPath,
    totalRuns: analyses.length,
    runs: analyses,
    aggregate: buildAggregateSummary(analyses),
  };

  await writeFile(outputPath, JSON.stringify(summary, null, 2));
  printSummary(summary);
  console.log(`Analysis saved to: ${outputPath}`);
}

async function loadHistory(): Promise<StoredRunHistory> {
  const text = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(text) as unknown;

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "runs" in parsed &&
    Array.isArray((parsed as { runs: unknown[] }).runs)
  ) {
    return parsed as StoredRunHistory;
  }

  throw new Error(
    "Expected tmp/profile-extraction-result.json to contain a { version, runs } history.",
  );
}

function normalizeStoredRun(run: StoredRunV2 | StoredRunLegacy): StoredRunV2[] {
  if ("provider" in run) {
    return [run];
  }

  const compareGroupId = run.runMode === "compare" ? run.runId : null;
  const normalized: StoredRunV2[] = [];

  if (run.runMode !== "openai-only") {
    normalized.push({
      runId: `${run.runId}:local`,
      createdAt: run.createdAt,
      sourcePdfPath: run.sourcePdfPath,
      compareEnabled: run.compareEnabled,
      runMode: run.runMode,
      compareGroupId,
      provider: "local",
      providerStatus: run.local.status,
      model: run.local.model,
      output: run.local.output,
      rawOutput: null,
      error: null,
      observations: run.observations,
      input: run.input,
      metrics: run.metrics.local,
      validationError: run.validation?.local ?? null,
    });
  }

  if (run.runMode !== "local-only") {
    normalized.push({
      runId: `${run.runId}:openai`,
      createdAt: run.createdAt,
      sourcePdfPath: run.sourcePdfPath,
      compareEnabled: run.compareEnabled,
      runMode: run.runMode,
      compareGroupId,
      provider: "openai",
      providerStatus: run.openai.status,
      model: run.openai.model,
      output: run.openai.output,
      rawOutput: run.openai.rawOutput ?? null,
      error: run.openai.error ?? null,
      observations: run.observations,
      input: run.input,
      metrics: run.metrics.openai,
      validationError: run.validation?.openai ?? null,
    });
  }

  return normalized;
}

function analyzeRun(run: StoredRunV2): AnalysisRun {
  const output = normalizeExtractedProfile(run.output);
  const profileValues = [
    output.profile.fullName,
    output.profile.email,
    output.profile.phone,
    output.profile.linkedin,
    output.profile.github,
    output.profile.location,
    output.profile.workModelPreference,
    output.profile.notes,
  ];
  const profileFieldsFilled = profileValues.filter(Boolean).length;
  const totalBullets = output.experiences.reduce(
    (sum, experience) => sum + experience.bullets.length,
    0,
  );
  const descriptionsPresent = output.experiences.filter(
    (experience) => !!experience.description,
  ).length;
  const skillLevelsFilled = output.skills.filter((skill) => !!skill.level).length;
  const yearsExperienceFilled = output.skills.filter(
    (skill) => skill.yearsExperience !== null && skill.yearsExperience > 0,
  ).length;
  const zeroYearsExperience = output.skills.filter(
    (skill) => skill.yearsExperience === 0,
  ).length;
  const suspiciousSkills = output.skills
    .map((skill) => skill.name)
    .filter((name) =>
      ["Português", "Inglês", "English", "Portuguese"].includes(name),
    );
  const suspiciousLinks = [
    output.profile.linkedin,
    output.profile.github,
  ].filter((value): value is string =>
    Boolean(value && !value.includes("http") && !value.includes(".")),
  );

  const nullFieldCount =
    countNullishProfileFields(output) +
    output.experiences.reduce(
      (sum, experience) => sum + (experience.description ? 0 : 1),
      0,
    ) +
    output.skills.reduce(
      (sum, skill) =>
        sum +
        (skill.level ? 0 : 1) +
        (skill.yearsExperience === null ? 1 : 0) +
        (skill.category ? 0 : 1),
      0,
    ) +
    output.education.reduce(
      (sum, education) =>
        sum +
        (education.degree ? 0 : 1) +
        (education.field ? 0 : 1) +
        (education.startDate ? 0 : 1) +
        (education.endDate ? 0 : 1),
      0,
    );

  const totalInspectableFields =
    8 +
    output.experiences.length +
    output.skills.length * 3 +
    output.education.length * 4;
  const nullRate =
    totalInspectableFields > 0 ? nullFieldCount / totalInspectableFields : 1;

  const coverageScore = clampScore(
    profileFieldsFilled * 6 +
      output.experiences.length * 12 +
      Math.min(totalBullets, 12) * 2 +
      Math.min(output.skills.length, 25) * 1.2 +
      output.education.length * 15 +
      Math.min(output.projects.length, 5) * 4,
  );
  const precisionHeuristic = clampScore(
    100 -
      suspiciousSkills.length * 12 -
      suspiciousLinks.length * 10 -
      zeroYearsExperience * 3 -
      Math.max(0, skillLevelsFilled - output.skills.length * 0.8) * 4,
  );
  const utilityScore = clampScore(
    coverageScore * 0.45 +
      precisionHeuristic * 0.35 +
      descriptionsPresent * 6 +
      Math.min(skillLevelsFilled, 20) * 1.2,
  );

  return {
    runId: run.runId,
    createdAt: run.createdAt,
    provider: run.provider,
    providerStatus: run.providerStatus,
    model: run.model,
    runMode: run.runMode,
    compareEnabled: run.compareEnabled,
    compareGroupId: run.compareGroupId,
    sourcePdfPath: run.sourcePdfPath,
    coverage: {
      profileFieldsFilled,
      profileFieldsTotal: 8,
      experiences: output.experiences.length,
      totalBullets,
      skills: output.skills.length,
      education: output.education.length,
      projects: output.projects.length,
    },
    quality: {
      descriptionsPresent,
      skillLevelsFilled,
      yearsExperienceFilled,
      zeroYearsExperience,
      suspiciousSkills,
      suspiciousLinks,
      nullRate: round(nullRate, 4),
    },
    score: {
      coverage: round(coverageScore, 2),
      precisionHeuristic: round(precisionHeuristic, 2),
      utility: round(utilityScore, 2),
      overall: round(
        coverageScore * 0.4 + precisionHeuristic * 0.35 + utilityScore * 0.25,
        2,
      ),
    },
    metrics: run.metrics,
    validationError: run.validationError,
    error: run.error,
    observations: run.observations,
  };
}

function normalizeExtractedProfile(
  output: ExtractedProfile | Record<string, unknown> | null,
) {
  return {
    profile: {
      fullName: safeStringOrNull(output?.profile?.fullName),
      email: safeStringOrNull(output?.profile?.email),
      phone: safeStringOrNull(output?.profile?.phone),
      linkedin: safeStringOrNull(output?.profile?.linkedin),
      github: safeStringOrNull(output?.profile?.github),
      location: safeStringOrNull(output?.profile?.location),
      workModelPreference: safeStringOrNull(output?.profile?.workModelPreference),
      notes: safeStringOrNull(output?.profile?.notes),
      masterResumePath: safeStringOrNull(output?.profile?.masterResumePath),
    },
    experiences: Array.isArray(output?.experiences)
      ? output.experiences.map((experience) => ({
          company: safeString(experience.company),
          role: safeString(experience.role),
          startDate: safeString(experience.startDate),
          endDate: safeStringOrNull(experience.endDate),
          isCurrent: Boolean(experience.isCurrent),
          description: safeStringOrNull(experience.description),
          bullets: Array.isArray(experience.bullets)
            ? experience.bullets.map((bullet) => ({
                content: safeString(bullet.content),
                tags: Array.isArray(bullet.tags)
                  ? bullet.tags.map((tag) => safeString(tag)).filter(Boolean)
                  : [],
              }))
            : [],
        }))
      : [],
    skills: Array.isArray(output?.skills)
      ? output.skills.map((skill) => ({
          name: safeString(skill.name),
          level: safeStringOrNull(skill.level),
          yearsExperience:
            typeof skill.yearsExperience === "number"
              ? skill.yearsExperience
              : null,
          category: safeStringOrNull(skill.category),
        }))
      : [],
    projects: Array.isArray(output?.projects)
      ? output.projects.map((project) => ({
          name: safeString(project.name),
        }))
      : [],
    education: Array.isArray(output?.education)
      ? output.education.map((education) => ({
          institution: safeString(education.institution),
          degree: safeStringOrNull(education.degree),
          field: safeStringOrNull(education.field),
          startDate: safeStringOrNull(education.startDate),
          endDate: safeStringOrNull(education.endDate),
        }))
      : [],
  };
}

function buildAggregateSummary(runs: AnalysisRun[]): AggregateSummary {
  const providers: AggregateSummary["providers"] = {
    local: {
      runs: 0,
      successfulRuns: 0,
      avgOverall: 0,
      avgCoverage: 0,
      avgCostUsd: null,
    },
    openai: {
      runs: 0,
      successfulRuns: 0,
      avgOverall: 0,
      avgCoverage: 0,
      avgCostUsd: null,
    },
  };
  const providerCostSums = { local: 0, openai: 0 };
  const providerCostCounts = { local: 0, openai: 0 };
  const modelStats = new Map<
    string,
    {
      provider: Provider;
      model: string;
      runs: number;
      successfulRuns: number;
      overallSum: number;
      coverageSum: number;
      costSum: number;
      costCount: number;
      schemaFailures: number;
      providerErrors: number;
    }
  >();

  for (const run of runs) {
    providers[run.provider].runs += 1;
    if (run.providerStatus === "success") {
      providers[run.provider].successfulRuns += 1;
      providers[run.provider].avgOverall += run.score.overall;
      providers[run.provider].avgCoverage += run.score.coverage;
    }

    if (run.metrics.costUsd !== null) {
      providerCostSums[run.provider] += run.metrics.costUsd;
      providerCostCounts[run.provider] += 1;
    }

    const model = run.model ?? "unknown";
    const key = `${run.provider}:${model}`;
    const current = modelStats.get(key) ?? {
      provider: run.provider,
      model,
      runs: 0,
      successfulRuns: 0,
      overallSum: 0,
      coverageSum: 0,
      costSum: 0,
      costCount: 0,
      schemaFailures: 0,
      providerErrors: 0,
    };
    current.runs += 1;
    if (run.providerStatus === "success") {
      current.successfulRuns = (current.successfulRuns ?? 0) + 1;
      current.overallSum += run.score.overall;
      current.coverageSum += run.score.coverage;
    }
    if (run.metrics.costUsd !== null) {
      current.costSum += run.metrics.costUsd;
      current.costCount += 1;
    }
    if (run.validationError) {
      current.schemaFailures += 1;
    }
    if (run.providerStatus === "error") {
      current.providerErrors += 1;
    }
    modelStats.set(key, current);
  }

  for (const provider of ["local", "openai"] as const) {
    if (providers[provider].successfulRuns > 0) {
      providers[provider].avgOverall = round(
        providers[provider].avgOverall / providers[provider].successfulRuns,
        2,
      );
      providers[provider].avgCoverage = round(
        providers[provider].avgCoverage / providers[provider].successfulRuns,
        2,
      );
    }
    if (providerCostCounts[provider] > 0) {
      providers[provider].avgCostUsd = round(
        providerCostSums[provider] / providerCostCounts[provider],
        6,
      );
    }
  }

  return {
    providers,
    models: Array.from(modelStats.values())
      .map((model) => ({
        provider: model.provider,
        model: model.model,
        runs: model.runs,
        successfulRuns: model.successfulRuns ?? 0,
        avgOverall:
          (model.successfulRuns ?? 0) > 0
            ? round(model.overallSum / (model.successfulRuns ?? 1), 2)
            : 0,
        avgCoverage:
          (model.successfulRuns ?? 0) > 0
            ? round(model.coverageSum / (model.successfulRuns ?? 1), 2)
            : 0,
        avgCostUsd:
          model.costCount > 0 ? round(model.costSum / model.costCount, 6) : null,
        schemaFailures: model.schemaFailures,
        providerErrors: model.providerErrors,
      }))
      .sort((a, b) => {
        if (b.avgOverall !== a.avgOverall) {
          return b.avgOverall - a.avgOverall;
        }

        if (a.providerErrors !== b.providerErrors) {
          return a.providerErrors - b.providerErrors;
        }

        return b.avgCoverage - a.avgCoverage;
      }),
  };
}

function printSummary(summary: {
  totalRuns: number;
  runs: AnalysisRun[];
  aggregate: AggregateSummary;
}) {
  console.log(pc.bold(`Total de runs analisadas: ${summary.totalRuns}`));
  console.log(pc.dim("Legenda:"));
  console.log(
    pc.dim(
      "  Nota Geral = combinação ponderada de cobertura, precisão heurística e utilidade.",
    ),
  );
  console.log(
    pc.dim(
      "  Cobertura = quanto do schema esperado foi preenchido com conteúdo utilizável.",
    ),
  );
  console.log(
    pc.dim(
      "  Precisão Heurística = penalização simples para sinais de baixa confiabilidade, como links suspeitos, idiomas em skills e yearsExperience zerado.",
    ),
  );
  console.log(
    pc.dim(
      "  Utilidade = quão útil o output parece para revisão humana e persistência, favorecendo cobertura boa com descrições e estrutura aproveitável.",
    ),
  );
  console.log(
    pc.dim(
      "  Taxa de Nulos = proporção de campos inspecionáveis que vieram vazios ou indefinidos.",
    ),
  );

  for (const [index, run] of summary.runs.entries()) {
    console.log("");
    console.log(pc.dim("=".repeat(88)));
    console.log(
      pc.bold(
        `${index + 1}/${summary.totalRuns} | ${formatProviderLabel(run.provider)} | ${run.model ?? "modelo desconhecido"}`,
      ),
    );
    console.log(
      pc.dim(
        `status=${formatStatusLabel(run.providerStatus)} | modo=${formatRunMode(run.runMode)} | grupo=${run.compareGroupId ?? "-"} | data=${run.createdAt}`,
      ),
    );
    console.log(pc.dim(`arquivo=${path.basename(run.sourcePdfPath)} | runId=${run.runId}`));

    const resumoTable = new Table({
      head: [
        "Nota Geral",
        "Cobertura",
        "Precisão Heurística",
        "Utilidade",
        "Custo",
      ],
      style: { head: [], border: [] },
      colWidths: [14, 12, 22, 12, 12],
    });
    resumoTable.push([
      formatScore(run.score.overall),
      formatScore(run.score.coverage),
      formatScore(run.score.precisionHeuristic),
      formatScore(run.score.utility),
      formatUsd(run.metrics.costUsd),
    ]);

    const coverageTable = new Table({
      head: [
        "Campos de Perfil",
        "Experiências",
        "Bullets",
        "Skills",
        "Educação",
        "Projetos",
        "Taxa de Nulos",
      ],
      style: { head: [], border: [] },
      colWidths: [18, 13, 10, 10, 10, 10, 16],
    });
    coverageTable.push([
      `${run.coverage.profileFieldsFilled}/${run.coverage.profileFieldsTotal}`,
      String(run.coverage.experiences),
      String(run.coverage.totalBullets),
      String(run.coverage.skills),
      String(run.coverage.education),
      String(run.coverage.projects),
      formatPercent(run.quality.nullRate),
    ]);

    const qualityTable = new Table({
      head: [
        "Descrições",
        "Levels Preenchidos",
        "Anos Preenchidos",
        "Skills com Zero Anos",
        "Status do Schema",
        "Sinais de Alerta",
      ],
      style: { head: [], border: [] },
      colWidths: [12, 20, 18, 22, 18, 16],
    });
    qualityTable.push([
      String(run.quality.descriptionsPresent),
      String(run.quality.skillLevelsFilled),
      String(run.quality.yearsExperienceFilled),
      String(run.quality.zeroYearsExperience),
      formatSchemaStatus(run.validationError),
      String(
        run.quality.suspiciousSkills.length + run.quality.suspiciousLinks.length,
      ),
    ]);

    console.log(pc.bold("Resumo"));
    console.log(resumoTable.toString());
    console.log(pc.bold("Cobertura"));
    console.log(coverageTable.toString());
    console.log(pc.bold("Qualidade"));
    console.log(qualityTable.toString());

    console.log(
      pc.dim(
        `tokens: entrada=${formatMetric(run.metrics.inputTokens)} | saida=${formatMetric(run.metrics.outputTokens)} | reasoning=${formatMetric(run.metrics.reasoningTokens)}`,
      ),
    );

    if (run.validationError) {
      console.log(pc.red(`  aviso de schema: ${run.validationError}`));
    }
    if (run.error) {
      console.log(pc.red(`  erro do provider: ${run.error}`));
    }
    if (run.quality.suspiciousSkills.length > 0) {
      console.log(`  skills suspeitas: ${run.quality.suspiciousSkills.join(", ")}`);
    }
    if (run.quality.suspiciousLinks.length > 0) {
      console.log(`  links suspeitos: ${run.quality.suspiciousLinks.join(", ")}`);
    }
  }

  console.log("");
  console.log(pc.bold("Agregado Por Provider"));
  const providerTable = new Table({
    head: [
      "Provider",
      "Runs",
      "Runs com Sucesso",
      "Média Nota Geral",
      "Média Cobertura",
      "Custo Médio",
    ],
    style: { head: [], border: [] },
    colWidths: [10, 8, 18, 18, 18, 14],
  });
  for (const provider of ["local", "openai"] as const) {
    const item = summary.aggregate.providers[provider];
    providerTable.push([
      colorProvider(provider),
      String(item.runs),
      String(item.successfulRuns),
      formatScore(item.avgOverall),
      formatScore(item.avgCoverage),
      formatUsd(item.avgCostUsd),
    ]);
  }
  console.log(providerTable.toString());

  console.log(pc.bold("Agregado Por Modelo"));
  const modelTable = new Table({
    head: [
      "Provider",
      "Modelo",
      "Runs",
      "Runs com Sucesso",
      "Média Nota Geral",
      "Média Cobertura",
      "Custo Médio",
      "Falhas de Schema",
      "Erros do Provider",
    ],
    style: { head: [], border: [] },
    colWidths: [10, 22, 6, 18, 18, 18, 14, 18, 18],
    wordWrap: true,
  });
  for (const model of summary.aggregate.models) {
    modelTable.push([
      colorProvider(model.provider),
      model.model,
      String(model.runs),
      String(model.successfulRuns),
      formatScore(model.avgOverall),
      formatScore(model.avgCoverage),
      formatUsd(model.avgCostUsd),
      model.schemaFailures > 0 ? pc.red(String(model.schemaFailures)) : "0",
      model.providerErrors > 0 ? pc.red(String(model.providerErrors)) : "0",
    ]);
  }
  console.log(modelTable.toString());

  console.log(pc.bold("Ranking De Modelos"));
  const rankingTable = new Table({
    head: [
      "Posição",
      "Provider",
      "Modelo",
      "Runs com Sucesso",
      "Média Nota Geral",
      "Média Cobertura",
      "Custo Médio",
      "Falhas de Schema",
      "Erros do Provider",
    ],
    style: { head: [], border: [] },
    colWidths: [10, 10, 22, 18, 18, 18, 14, 18, 18],
    wordWrap: true,
  });

  for (const [index, model] of summary.aggregate.models.entries()) {
    rankingTable.push([
      `${index + 1}º`,
      colorProvider(model.provider),
      model.model,
      String(model.successfulRuns),
      formatScore(model.avgOverall),
      formatScore(model.avgCoverage),
      formatUsd(model.avgCostUsd),
      model.schemaFailures > 0 ? pc.red(String(model.schemaFailures)) : "0",
      model.providerErrors > 0 ? pc.red(String(model.providerErrors)) : "0",
    ]);
  }

  console.log(rankingTable.toString());
}

function countNullishProfileFields(output: ReturnType<typeof normalizeExtractedProfile>) {
  return [
    output.profile.fullName,
    output.profile.email,
    output.profile.phone,
    output.profile.linkedin,
    output.profile.github,
    output.profile.location,
    output.profile.workModelPreference,
    output.profile.notes,
  ].filter((value) => !value).length;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatUsd(value: number | null) {
  if (value === null) {
    return "unknown";
  }
  if (value === 0) {
    return "US$0.00";
  }
  if (value < 0.01) {
    return `US$${value.toFixed(4)}`;
  }
  return `US$${value.toFixed(2)}`;
}

function formatMetric(value: number | null) {
  return value === null ? "unknown" : String(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function colorProvider(provider: Provider) {
  return provider === "local" ? pc.cyan("local") : pc.green("openai");
}

function formatProviderLabel(provider: Provider) {
  return provider === "local" ? pc.cyan("LOCAL") : pc.green("OPENAI");
}

function formatScore(value: number) {
  const text = value.toFixed(2);
  if (value >= 85) {
    return pc.green(text);
  }
  if (value >= 70) {
    return pc.yellow(text);
  }
  return pc.red(text);
}

function formatSchemaStatus(error: string | null) {
  return error ? pc.red("aviso") : pc.green("ok");
}

function formatStatusLabel(status: AnalysisRun["providerStatus"]) {
  if (status === "success") {
    return pc.green("sucesso");
  }

  if (status === "error") {
    return pc.red("erro");
  }

  return pc.dim("ignorado");
}

function formatRunMode(runMode: RunMode) {
  if (runMode === "compare") {
    return "comparação";
  }

  if (runMode === "openai-only") {
    return "somente openai";
  }

  return "somente local";
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeStringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Profile extraction analysis failed: ${message}`);
  process.exitCode = 1;
});
