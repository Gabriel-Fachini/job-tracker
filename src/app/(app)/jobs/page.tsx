import Link from "next/link";
import { desc } from "drizzle-orm";
import { Activity, BriefcaseBusiness, Orbit, Radar } from "lucide-react";

import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import {
  formatDate,
  getSeniorityLabel,
  getSourceNameLabel,
  getWorkModelLabel,
  isJobStatus,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

export default async function JobsPage() {
  const listQuery = db
    .select({
      id: jobs.id,
      title: jobs.title,
      status: jobs.status,
      company: jobs.company,
      sourceName: jobs.sourceName,
      workModel: jobs.workModel,
      seniority: jobs.seniority,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .orderBy(desc(jobs.createdAt));

  const items = listQuery.all();
  const interestingCount = items.filter((item) => item.status === "interesting").length;
  const applyingCount = items.filter((item) => item.status === "applying").length;
  const appliedCount = items.filter((item) => item.status === "applied").length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.14),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6 sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.03),transparent)] lg:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Radar de vagas
            </h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-400/16 bg-amber-400/8 p-4">
              <Radar className="mb-4 text-amber-200" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Interessantes
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {interestingCount}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-400/16 bg-sky-400/8 p-4">
              <Orbit className="mb-4 text-sky-200" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Aplicando
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {applyingCount}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/16 bg-emerald-400/8 p-4">
              <Activity className="mb-4 text-emerald-200" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Aplicadas
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {appliedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Vagas cadastradas
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "vaga registrada" : "vagas registradas"}
          </p>
        </div>
        <Link
          href="/jobs/new"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 min-w-44 justify-center rounded-xl bg-amber-300 px-6 text-zinc-950 shadow-[0_12px_30px_rgba(252,211,77,0.22)] hover:bg-amber-200",
          )}
        >
          <BriefcaseBusiness data-icon="inline-start" />
          Nova vaga
        </Link>
      </div>

      {items.length === 0 ? (
        <Card className="border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]">
          <CardHeader className="pb-3">
            <CardTitle>Nenhuma vaga salva ainda</CardTitle>
            <CardDescription>
              Comece pelo fluxo manual e preserve a descrição completa da vaga
              localmente antes que ela saia do ar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/jobs/new"
              className={cn(buttonVariants({}))}
            >
              Registrar primeira vaga
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/jobs/${item.id}`}
              className="group block transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="cursor-pointer border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] transition-all duration-200 group-hover:border-border group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-xl leading-tight text-foreground">
                        {item.title}
                      </CardTitle>
                    </div>
                    <CardAction className="static">
                      {isJobStatus(item.status) ? (
                        <JobStatusBadge status={item.status} />
                      ) : null}
                    </CardAction>
                  </div>
                  <CardDescription className="text-sm">
                    {item.company ?? "Sem empresa informada"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {getWorkModelLabel(item.workModel) ? (
                      <span className="rounded-full border border-white/8 bg-background/70 px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {getWorkModelLabel(item.workModel)}
                      </span>
                    ) : null}
                    {getSeniorityLabel(item.seniority) ? (
                      <span className="rounded-full border border-white/8 bg-background/70 px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {getSeniorityLabel(item.seniority)}
                      </span>
                    ) : null}
                    {getSourceNameLabel(item.sourceName) ? (
                      <span className="rounded-full border border-white/8 bg-background/70 px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {getSourceNameLabel(item.sourceName)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>Criada em {formatDate(item.createdAt)}</span>
                    <span className="text-foreground/80 transition-transform group-hover:translate-x-0.5">
                      Abrir vaga
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
