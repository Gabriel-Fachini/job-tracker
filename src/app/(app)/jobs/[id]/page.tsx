import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  Layers3,
  RadioTower,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { JobCreateForm } from "@/components/jobs/job-create-form";
import { JobMarkdown } from "@/components/jobs/job-markdown";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import {
  getSeniorityLabel,
  getSourceNameLabel,
  getWorkModelLabel,
  isJobStatus,
} from "@/lib/jobs";
import { updateJob } from "@/server/actions/jobs";
import { cn } from "@/lib/utils";

type JobDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    mode?: string;
  }>;
};

type SummaryItem = {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClassName: string;
};

export default async function JobDetailsPage({
  params,
  searchParams,
}: JobDetailsPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const hasValidationError = resolvedSearchParams?.error === "validation";
  const isEditing = resolvedSearchParams?.mode === "edit";
  const jobId = Number(id);

  if (!Number.isInteger(jobId) || jobId <= 0) {
    notFound();
  }

  const job = db
    .select({
      id: jobs.id,
      title: jobs.title,
      status: jobs.status,
      company: jobs.company,
      description: jobs.description,
      sourceName: jobs.sourceName,
      sourceUrl: jobs.sourceUrl,
      workModel: jobs.workModel,
      seniority: jobs.seniority,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get();

  if (!job || !isJobStatus(job.status)) {
    notFound();
  }

  const summaryItems: SummaryItem[] = [
    {
      label: "Empresa",
      value: job.company ?? "Não informada",
      icon: Building2,
      accentClassName:
        "border-amber-400/18 bg-linear-to-br from-amber-400/16 to-transparent",
    },
    {
      label: "Origem",
      value: getSourceNameLabel(job.sourceName) ?? "Não informada",
      icon: RadioTower,
      accentClassName:
        "border-sky-400/18 bg-linear-to-br from-sky-400/16 to-transparent",
    },
    {
      label: "Modelo",
      value: getWorkModelLabel(job.workModel) ?? "Não informado",
      icon: Layers3,
      accentClassName:
        "border-violet-400/18 bg-linear-to-br from-violet-400/16 to-transparent",
    },
    {
      label: "Senioridade",
      value: getSeniorityLabel(job.seniority) ?? "Não informada",
      icon: Sparkles,
      accentClassName:
        "border-emerald-400/18 bg-linear-to-br from-emerald-400/16 to-transparent",
    },
    {
      label: "Criada em",
      value: job.createdAt.toLocaleDateString("pt-BR"),
      icon: CalendarDays,
      accentClassName:
        "border-rose-400/18 bg-linear-to-br from-rose-400/16 to-transparent",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <Link
            href="/jobs"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {job.title}
            </h1>
            <p className="text-lg font-medium tracking-tight text-foreground/92">
              {job.company ?? "Sem empresa informada"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <JobStatusBadge status={job.status} />
            {!isEditing ? (
              <Link
                href={`/jobs/${job.id}?mode=edit`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Editar
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {!isEditing ? (
        <Card className="overflow-hidden border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]">
          <CardHeader className="gap-3 border-b border-border/60 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex max-w-2xl flex-col gap-2">
                <CardTitle className="text-2xl sm:text-3xl">
                  Resumo operacional
                </CardTitle>
              </div>

              {job.sourceUrl ? (
                <Link
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-4")}
                >
                  Ir para vaga
                  <ExternalLink data-icon="inline-end" />
                </Link>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-5">
            {summaryItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className={`rounded-xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${item.accentClassName}`}
                >
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                      {item.label}
                    </p>
                    <span className="flex size-8 items-center justify-center text-muted-foreground">
                      <Icon />
                    </span>
                  </div>
                  <p className="text-balance text-base leading-6 font-medium text-foreground">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Editar vaga" : "Descrição da vaga"}</CardTitle>
          {isEditing ? (
            <CardDescription>
              Atualize os metadados e a descrição sem sair da página.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <>
              {hasValidationError ? (
                <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  Não foi possível salvar a edição. Revise os campos obrigatórios e
                  a URL antes de tentar novamente.
                </p>
              ) : null}
              <JobCreateForm
                action={updateJob.bind(null, job.id)}
                cancelHref={`/jobs/${job.id}`}
                submitLabel="Salvar alterações"
                defaultValues={job}
              />
            </>
          ) : (
            <JobMarkdown
              content={job.description}
              className="markdown-content rounded-lg border border-border bg-background/70 p-5"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
