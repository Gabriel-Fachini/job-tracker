import type { ProfileSnapshot } from "@/lib/profile/editor";

import type { ExtractedJobDetail, JobLeadSignals } from "./types";

const STACK_PATTERNS = [
  { label: "Node.js", pattern: /\b(node\.?js|node)\b/ },
  { label: "TypeScript", pattern: /\btypescript\b|\bts\b/ },
  { label: "JavaScript", pattern: /\bjavascript\b|\bjs\b/ },
  { label: "React", pattern: /\breact\b/ },
  { label: "Next.js", pattern: /\bnext\.?js\b|\bnext\b/ },
  { label: "Python", pattern: /\bpython\b/ },
  { label: "Java", pattern: /\bjava\b/ },
  { label: "Kotlin", pattern: /\bkotlin\b/ },
  { label: "Go", pattern: /\bgo(lang)?\b/ },
  { label: "AWS", pattern: /\baws\b|amazon web services/ },
  { label: "GCP", pattern: /\bgcp\b|google cloud/ },
  { label: "Azure", pattern: /\bazure\b/ },
  { label: "PostgreSQL", pattern: /\bpostgres(ql)?\b/ },
  { label: "MySQL", pattern: /\bmysql\b/ },
  { label: "Docker", pattern: /\bdocker\b/ },
  { label: "Kubernetes", pattern: /\bkubernetes\b|\bk8s\b/ },
  { label: "GraphQL", pattern: /\bgraphql\b/ },
  { label: "React Native", pattern: /\breact native\b/ },
  { label: "Vue", pattern: /\bvue\b/ },
  { label: "Angular", pattern: /\bangular\b/ },
  { label: ".NET", pattern: /\b\.net\b|\bc#\b|dotnet/ },
  { label: "Ruby on Rails", pattern: /\bruby\b|\brails\b/ },
  { label: "PHP", pattern: /\bphp\b/ },
  { label: "Flutter", pattern: /\bflutter\b/ },
  { label: "SQL", pattern: /\bsql\b/ },
];

const MAJOR_BRAZIL_LOCATIONS = [
  "brasil",
  "sao paulo",
  "rio de janeiro",
  "belo horizonte",
  "curitiba",
  "porto alegre",
  "florianopolis",
  "campinas",
  "recife",
  "salvador",
  "fortaleza",
  "goiania",
  "brasilia",
];

const BRAZIL_STATE_PATTERNS = [
  /\bsp\b/,
  /\brj\b/,
  /\bmg\b/,
  /\bpr\b/,
  /\brs\b/,
  /\bsc\b/,
  /\bba\b/,
  /\bpe\b/,
  /\bce\b/,
  /\bdf\b/,
  /\bgo\b/,
];

export function normalizeBrazilianJobText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}\s./+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractJobSignals(job: ExtractedJobDetail): JobLeadSignals {
  const normalizedTitle = normalizeBrazilianJobText(job.title);
  const normalizedDescription = normalizeBrazilianJobText(job.description);
  const combined = `${normalizedTitle} ${normalizedDescription}`.trim();

  return {
    normalizedTitle,
    normalizedDescription,
    detectedSeniority: detectSenioritySignal(combined),
    detectedWorkModels: detectWorkModels(combined, job.workModel),
    employmentTypes: detectEmploymentTypes(combined),
    locationSignals: detectLocationSignals(
      combined,
      normalizeBrazilianJobText(job.locationText),
    ),
    jobFamily: detectJobFamily(combined),
    stackSignals: detectStackSignals(combined),
    positiveSignals: detectPositiveSignals(combined),
    blockedSignals: detectBlockedSignals(combined),
  };
}

export function buildSignalAssessment(
  signals: JobLeadSignals,
  profile: ProfileSnapshot | null,
): Pick<
  ReturnType<typeof buildEmptyClassificationSignals>,
  "matchedSignals" | "riskSignals" | "missingSignals"
> {
  const assessment = buildEmptyClassificationSignals();

  if (!signals.detectedSeniority) {
    assessment.missingSignals.push("Senioridade nao identificada");
  }

  if (signals.detectedWorkModels.length === 0) {
    assessment.missingSignals.push("Modelo de trabalho nao identificado");
  }

  if (signals.stackSignals.length === 0) {
    assessment.missingSignals.push("Stack tecnica nao identificada");
  }

  if (signals.locationSignals.length === 0) {
    assessment.missingSignals.push("Localizacao nao identificada");
  }

  if (signals.blockedSignals.length > 0) {
    assessment.riskSignals.push(...signals.blockedSignals);
  }

  if (signals.positiveSignals.length > 0) {
    assessment.matchedSignals.push(...signals.positiveSignals);
  }

  if (!profile) {
    assessment.missingSignals.push("Perfil principal indisponivel");
    return assessment;
  }

  const profileSkills = new Set(
    profile.skills.map((skill) => normalizeBrazilianJobText(skill.name)),
  );
  const stackOverlap = signals.stackSignals.filter((stack) =>
    profileSkills.has(normalizeBrazilianJobText(stack)),
  );

  if (stackOverlap.length > 0) {
    assessment.matchedSignals.push(`Stack em comum: ${stackOverlap.join(", ")}`);
  } else if (signals.stackSignals.length > 0) {
    assessment.riskSignals.push(
      `Stack principal sem evidencia no perfil: ${signals.stackSignals.slice(0, 4).join(", ")}`,
    );
  }

  if (
    profile.workModelPreference &&
    signals.detectedWorkModels.includes(profile.workModelPreference)
  ) {
    assessment.matchedSignals.push(
      `Modelo de trabalho compativel: ${profile.workModelPreference}`,
    );
  } else if (
    profile.workModelPreference === "remote" &&
    signals.detectedWorkModels.includes("onsite")
  ) {
    assessment.riskSignals.push("Vaga presencial para perfil com preferencia remota");
  }

  const profileSeniority = inferProfileSeniority(profile);
  if (signals.detectedSeniority && profileSeniority) {
    if (
      isMoreJuniorThanProfile(signals.detectedSeniority, profileSeniority)
    ) {
      assessment.riskSignals.push(
        `Senioridade abaixo do historico recente: ${signals.detectedSeniority}`,
      );
    } else {
      assessment.matchedSignals.push(
        `Senioridade proxima ao historico recente: ${signals.detectedSeniority}`,
      );
    }
  }

  if (
    signals.jobFamily === "sales" &&
    stackOverlap.length === 0 &&
    profile.skills.length > 0
  ) {
    assessment.riskSignals.push("Familia de vaga parece fora do foco tecnico atual");
  }

  return assessment;
}

function buildEmptyClassificationSignals() {
  return {
    matchedSignals: [] as string[],
    riskSignals: [] as string[],
    missingSignals: [] as string[],
  };
}

function detectSenioritySignal(text: string) {
  if (/\b(estagio|estagiario|internship|intern)\b/.test(text)) {
    return "intern";
  }
  if (/\b(junior|jr|trainee|entry level)\b/.test(text)) {
    return "junior";
  }
  if (/\b(pleno|pl|mid|intermediario)\b/.test(text)) {
    return "mid";
  }
  if (/\b(senior|sr|especialista)\b/.test(text)) {
    return "senior";
  }
  if (/\b(staff|principal)\b/.test(text)) {
    return "staff";
  }
  if (/\b(lead|tech lead|lider tecnico)\b/.test(text)) {
    return "lead";
  }
  return null;
}

function detectWorkModels(text: string, workModel: string | null) {
  const detected = new Set<string>();

  const normalizedWorkModel = normalizeBrazilianJobText(workModel);
  if (normalizedWorkModel === "remote") {
    detected.add("remote");
  }
  if (normalizedWorkModel === "hybrid") {
    detected.add("hybrid");
  }
  if (normalizedWorkModel === "onsite") {
    detected.add("onsite");
  }

  if (/\b(remoto|remota|remote|home office|work from home|anywhere)\b/.test(text)) {
    detected.add("remote");
  }
  if (/\b(hibrido|hibrida|hybrid)\b/.test(text)) {
    detected.add("hybrid");
  }
  if (/\b(presencial|onsite|on-site|in office)\b/.test(text)) {
    detected.add("onsite");
  }

  return [...detected];
}

function detectEmploymentTypes(text: string) {
  const detected = new Set<string>();

  if (/\bclt\b/.test(text)) {
    detected.add("clt");
  }
  if (/\bpj\b/.test(text)) {
    detected.add("pj");
  }
  if (/\b(contractor|freelance)\b/.test(text)) {
    detected.add("contractor");
  }
  if (/\b(estagio|internship|intern)\b/.test(text)) {
    detected.add("internship");
  }
  if (/\b(part time|part-time)\b/.test(text)) {
    detected.add("part_time");
  }
  if (/\b(full time|full-time|tempo integral)\b/.test(text)) {
    detected.add("full_time");
  }

  return [...detected];
}

function detectLocationSignals(text: string, locationText: string) {
  const detected = new Set<string>();
  const combined = `${text} ${locationText}`.trim();

  for (const location of MAJOR_BRAZIL_LOCATIONS) {
    if (combined.includes(location)) {
      detected.add(location);
    }
  }

  for (const pattern of BRAZIL_STATE_PATTERNS) {
    const match = combined.match(pattern);
    if (match?.[0]) {
      detected.add(match[0].toUpperCase());
    }
  }

  return [...detected];
}

function detectJobFamily(text: string) {
  if (
    /\b(backend|frontend|fullstack|mobile|software|engenheiro|engenharia|devops|sre|qa|plataforma|platform)\b/.test(
      text,
    )
  ) {
    return "engineering";
  }
  if (/\b(dados|data|analytics|analista de dados|cientista de dados|bi|machine learning|ml)\b/.test(text)) {
    return "data";
  }
  if (/\b(produto|product manager|product owner|pm|ux|ui|designer)\b/.test(text)) {
    return "product";
  }
  if (/\b(vendas|sales|account executive|bdr|sdr|comercial)\b/.test(text)) {
    return "sales";
  }
  if (/\b(marketing|growth|seo|crm)\b/.test(text)) {
    return "marketing";
  }
  return null;
}

function detectStackSignals(text: string) {
  const detected = new Set<string>();

  for (const entry of STACK_PATTERNS) {
    if (entry.pattern.test(text)) {
      detected.add(entry.label);
    }
  }

  return [...detected];
}

function detectPositiveSignals(text: string) {
  const detected = new Set<string>();

  if (/\b(remoto|remote|hibrido|hybrid)\b/.test(text)) {
    detected.add("Modelo de trabalho explicitado");
  }
  if (/\b(brasil|latin america|latam)\b/.test(text)) {
    detected.add("Escopo geografico explicito");
  }
  if (/\b(clt|pj|contractor)\b/.test(text)) {
    detected.add("Regime de contratacao explicitado");
  }

  return [...detected];
}

function detectBlockedSignals(text: string) {
  const detected = new Set<string>();

  if (/\b(estagio|internship|intern)\b/.test(text)) {
    detected.add("Vaga com senioridade de entrada");
  }
  if (/\b(vendas|sales|account executive|bdr|sdr|comercial)\b/.test(text)) {
    detected.add("Vaga parece orientada a vendas");
  }

  return [...detected];
}

function inferProfileSeniority(profile: ProfileSnapshot) {
  const recentRoleText = normalizeBrazilianJobText(
    profile.experiences
      .slice(0, 4)
      .map((experience) => experience.role)
      .join(" "),
  );

  return detectSenioritySignal(recentRoleText);
}

function isMoreJuniorThanProfile(jobSeniority: string, profileSeniority: string) {
  const order = ["intern", "junior", "mid", "senior", "staff", "lead"];
  return order.indexOf(jobSeniority) < order.indexOf(profileSeniority);
}
