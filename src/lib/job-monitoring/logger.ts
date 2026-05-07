import pc from "picocolors";

import type { MonitoringSummary } from "./types";

export type CompanyReportEntry = {
  name: string;
  summary: MonitoringSummary;
  durationMs: number;
};

export function logMonitoringStep(
  company: string,
  step: string,
  payload: Record<string, unknown> = {},
) {
  const prefix = pc.dim("[job-monitoring]");
  const tag = `[${pc.bold(pc.cyan(company))}]`;

  const isError = step.includes("failed") || step.includes("error");
  const isFinished = step.includes("finished");
  const isSkip = step.includes("skip");

  const label = isError
    ? pc.bold(pc.red(step))
    : isFinished
    ? pc.bold(pc.green(step))
    : isSkip
    ? pc.dim(step)
    : pc.bold(step);

  const colorizedPayload = { ...payload };

  // durationMs: dim < 1s, yellow 1–3s, red > 3s
  if (typeof colorizedPayload.durationMs === "number") {
    const ms = colorizedPayload.durationMs as number;
    colorizedPayload.durationMs =
      ms > 3000
        ? pc.red(`${ms}ms`)
        : ms > 1000
        ? pc.yellow(`${ms}ms`)
        : pc.dim(`${ms}ms`);
  }

  // classification decision colors
  if (typeof colorizedPayload.decision === "string") {
    const d = colorizedPayload.decision as string;
    colorizedPayload.decision =
      d === "interesting"
        ? pc.green(d)
        : d === "review"
        ? pc.yellow(d)
        : pc.dim(d);
  }

  // isNew highlights inserts vs updates
  if (typeof colorizedPayload.isNew === "boolean") {
    colorizedPayload.isNew = colorizedPayload.isNew
      ? pc.green("true (insert)")
      : pc.dim("false (update)");
  }

  console.log(prefix, tag, label, colorizedPayload);
}

export function printRadarReport(
  results: CompanyReportEntry[],
  totalDurationMs: number,
) {
  if (results.length === 0) return;

  const totals = results.reduce(
    (acc, r) => ({
      linksFound: acc.linksFound + r.summary.linksFound,
      jobsParsed: acc.jobsParsed + r.summary.jobsParsed,
      leadsSaved: acc.leadsSaved + r.summary.leadsSaved,
      reviewsSaved: acc.reviewsSaved + r.summary.reviewsSaved,
      discarded: acc.discarded + r.summary.discarded,
      failed: acc.failed + r.summary.failed,
    }),
    { linksFound: 0, jobsParsed: 0, leadsSaved: 0, reviewsSaved: 0, discarded: 0, failed: 0 },
  );

  const nameW = Math.max(7, ...results.map((r) => r.name.length));
  // visible row width: nameW + (2+6) + (2+7) + (2+7) + (2+8) + (2+6) + (2+7) + (2+8) = nameW + 63
  const sep = pc.dim("─".repeat(nameW + 63));

  const pad = (n: number, w: number) => String(n).padStart(w);

  const fmtMs = (ms: number) => {
    const s = (ms / 1000).toFixed(1) + "s";
    return ms > 10000 ? pc.yellow(s.padStart(8)) : pc.dim(s.padStart(8));
  };

  const fmtSaved = (n: number) =>
    n > 0 ? pc.green(pad(n, 7)) : pc.dim(pad(n, 7));

  const fmtReview = (n: number) =>
    n > 0 ? pc.yellow(pad(n, 8)) : pc.dim(pad(n, 8));

  const fmtFailed = (n: number) =>
    n > 0 ? pc.bold(pc.red(pad(n, 7))) : pc.dim(pad(n, 7));

  const header = [
    "Empresa".padEnd(nameW),
    "Links".padStart(6),
    "Parsed".padStart(7),
    "Salvos".padStart(7),
    "Revisar".padStart(8),
    "Desc.".padStart(6),
    "Falhas".padStart(7),
    "Tempo".padStart(8),
  ].join("  ");

  const totalMs = fmtMs(totalDurationMs).trim();
  const empresas = results.length !== 1 ? "empresas" : "empresa";

  console.log();
  console.log(` ${sep}`);
  console.log(
    ` ${pc.bold(pc.green("RELATÓRIO DO RADAR"))} — ${pc.bold(String(results.length))} ${empresas} · ${totalMs}`,
  );
  console.log(` ${sep}`);
  console.log(` ${pc.dim(header)}`);
  console.log(` ${sep}`);

  for (const entry of results) {
    const s = entry.summary;
    const row = [
      pc.cyan(entry.name.padEnd(nameW)),
      pad(s.linksFound, 6),
      pad(s.jobsParsed, 7),
      fmtSaved(s.leadsSaved),
      fmtReview(s.reviewsSaved),
      pc.dim(pad(s.discarded, 6)),
      fmtFailed(s.failed),
      fmtMs(entry.durationMs),
    ].join("  ");
    console.log(` ${row}`);
  }

  console.log(` ${sep}`);

  const totalRow = [
    pc.bold("TOTAL".padEnd(nameW)),
    pc.bold(pad(totals.linksFound, 6)),
    pc.bold(pad(totals.jobsParsed, 7)),
    pc.bold(fmtSaved(totals.leadsSaved)),
    pc.bold(fmtReview(totals.reviewsSaved)),
    pc.bold(pc.dim(pad(totals.discarded, 6))),
    pc.bold(fmtFailed(totals.failed)),
    pc.bold(fmtMs(totalDurationMs)),
  ].join("  ");
  console.log(` ${totalRow}`);
  console.log(` ${sep}`);
  console.log();
}
