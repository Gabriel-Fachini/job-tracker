/**
 * Scores the triage on ~20 fictional vacancies (src/lib/job-monitoring/triage/__fixtures__).
 *
 *   npm run triage:eval                      # stage 0 (offline) + every configured engine (openai, jev)
 *   npm run triage:eval -- --engines jev     # only Jev (needs TYPESAFE_API_KEY)
 *   npm run triage:eval -- --engines ollama  # opt in to Ollama (never automatic)
 *   npm run triage:eval -- --engines jev --jev-base-url http://127.0.0.1:8000   # a self-hosted Jev-compatible server
 *
 * Engine-agnostic: every engine gets the same fixtures and the same scoring, so
 * `openai` and `jev` (official API or any TYPESAFE_BASE_URL) compare directly.
 *
 * Stage 0 needs no key and no network. Engines without their key are skipped.
 * Use the per-question accuracy to calibrate the thresholds in triage/rules.ts.
 */
import { evalJobs } from "../src/lib/job-monitoring/triage/__fixtures__/eval-jobs";
import { evaluateStageZero, formatPercent, runTriageEval } from "../src/lib/job-monitoring/triage/eval";
import { createOllamaEngine, createOpenAiEngine } from "../src/lib/job-monitoring/triage/engines/json-engine";
import { createJevEngine } from "../src/lib/job-monitoring/triage/engines/jev";
import type { TriageEngine } from "../src/lib/job-monitoring/triage/types";

function readEngines(): string[] {
  const index = process.argv.indexOf("--engines");

  if (index === -1) {
    return ["openai", "jev"];
  }

  return (process.argv[index + 1] ?? "").split(",").map((name) => name.trim()).filter(Boolean);
}

function applyBaseUrlFlag() {
  const index = process.argv.indexOf("--jev-base-url");

  if (index !== -1 && process.argv[index + 1]) {
    process.env.TYPESAFE_BASE_URL = process.argv[index + 1];
  }
}

function build(name: string): TriageEngine | null {
  try {
    if (name === "openai") return createOpenAiEngine();
    if (name === "jev") return createJevEngine();
    if (name === "ollama") return createOllamaEngine();
  } catch (error) {
    console.log(`- ${name}: pulado (${error instanceof Error ? error.message : "não configurado"})`);
    return null;
  }

  console.log(`- ${name}: motor desconhecido`);
  return null;
}

async function main() {
  applyBaseUrlFlag();

  const stage0 = evaluateStageZero();

  console.log(`Estágio 0 (filtros duros, sem modelo): ${stage0.correct}/${stage0.total} (${formatPercent(stage0.correct, stage0.total)})`);

  for (const mismatch of stage0.mismatches) {
    console.log(`  divergência ${mismatch.jobId}: esperado ${mismatch.expected ?? "passa"}, obtido ${mismatch.actual ?? "passa"}`);
  }

  const passing = evalJobs.filter((item) => item.expected.stage0 === null).length;

  console.log(`\n${passing} vagas seguem para os modelos.\n`);

  for (const name of readEngines()) {
    const engine = build(name);

    if (!engine) {
      continue;
    }

    console.log(`Motor ${engine.name} (${engine.model})`);

    const result = await runTriageEval(engine, evalJobs, { onProgress: (jobId) => process.stdout.write(`  ${jobId}\r`) });

    process.stdout.write(" ".repeat(60) + "\r");

    for (const score of result.scores) {
      console.log(`  ${score.question.padEnd(24)} ${String(score.correct).padStart(2)}/${String(score.total).padEnd(2)} ${formatPercent(score.correct, score.total)}`);
    }

    for (const error of result.errors) {
      console.log(`  erro em ${error.jobId}: ${error.message}`);
    }

    console.log("");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
