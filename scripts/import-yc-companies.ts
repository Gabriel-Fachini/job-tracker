/**
 * Imports Y Combinator companies that are hiring remotely (yc-oss dataset),
 * discovering each one's ATS (Ashby, Lever, Greenhouse).
 *
 *   npm run companies:import-yc -- --dry-run          # lists what would happen, writes nothing
 *   npm run companies:import-yc                       # upserts into DATABASE_URL
 *   npm run companies:import-yc -- --limit 20         # first 20 only (smoke test)
 *
 * Idempotent: companies already in the database keep their data; only those
 * without a job board get the discovered one. Take a backup first (npm run db:backup).
 */
import { createYcImportStore } from "../src/lib/companies/company-store";
import {
  fetchYcCompanies,
  filterYcCompanies,
  importYcCompanies,
} from "../src/lib/companies/yc-import";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);

  return index === -1 ? null : (process.argv[index + 1] ?? "");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitFlag = readFlag("--limit");
  const limit = limitFlag ? Number(limitFlag) : null;

  console.log("Baixando a lista da YC…");
  const all = await fetchYcCompanies();
  let selected = filterYcCompanies(all);

  console.log(`${all.length} empresas no dataset, ${selected.length} contratando com vagas remotas.`);

  if (limit && Number.isInteger(limit) && limit > 0) {
    selected = selected.slice(0, limit);
    console.log(`Limitado às primeiras ${selected.length}.`);
  }

  if (dryRun) {
    console.log("Modo --dry-run: nada será gravado.");
  } else {
    console.log(`Gravando em ${process.env.DATABASE_URL ?? "./job-tracker.db"}.`);
  }

  const { rows, summary } = await importYcCompanies({
    companies: selected,
    store: createYcImportStore(),
    dryRun,
    onProgress: (row, done, total) => {
      const ats = row.ats ? `${row.ats.provider}/${row.ats.slug} (${row.ats.jobsCount} vagas, via ${row.ats.via})` : "sem ATS";

      console.log(`[${done}/${total}] ${row.name} - ${row.action} - ${ats}`);
    },
  });

  console.log("\nResumo");
  console.log(`  empresas processadas: ${summary.total}`);
  console.log(`  ${dryRun ? "seriam criadas" : "criadas"}: ${summary.created}`);
  console.log(`  ${dryRun ? "receberiam ATS" : "atualizadas com ATS"}: ${summary.updated}`);
  console.log(`  sem mudança: ${summary.unchanged}`);
  console.log(`  com ATS encontrado: ${summary.withAts} (${Object.entries(summary.byProvider).map(([provider, count]) => `${provider}: ${count}`).join(", ") || "nenhum"})`);
  console.log(`  sem ATS (radar desligado): ${summary.withoutAts}`);

  if (dryRun) {
    const found = rows.filter((row) => row.ats).length;

    console.log(`\n--dry-run: ${found} empresas teriam radar ligado. Rode sem a flag para gravar.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
