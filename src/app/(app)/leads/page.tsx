import Link from "next/link";
import { desc, eq, ne } from "drizzle-orm";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Radar,
  ScanSearch,
} from "lucide-react";

import { FormSubmitButton } from "@/components/companies/form-submit-button";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { db } from "@/lib/db";
import { companies, jobLeads } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import {
  discardLead,
  promoteLeadToApplication,
  runAllCompaniesMonitoring,
} from "@/server/actions/job-monitoring";

export default async function LeadsPage() {
  const rows = db
    .select({
      id: jobLeads.id,
      title: jobLeads.title,
      sourceUrl: jobLeads.sourceUrl,
      sourceName: jobLeads.sourceName,
      description: jobLeads.description,
      workModel: jobLeads.workModel,
      seniority: jobLeads.seniority,
      locationText: jobLeads.locationText,
      salaryText: jobLeads.salaryText,
      classificationStatus: jobLeads.classificationStatus,
      classificationScore: jobLeads.classificationScore,
      classificationReason: jobLeads.classificationReason,
      promotedToApplicationId: jobLeads.promotedToApplicationId,
      discoveredAt: jobLeads.discoveredAt,
      updatedAt: jobLeads.updatedAt,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(jobLeads)
    .innerJoin(companies, eq(jobLeads.companyId, companies.id))
    .where(ne(jobLeads.classificationStatus, "discarded"))
    .orderBy(desc(jobLeads.updatedAt))
    .all();

  const reviewCount = rows.filter((row) => row.classificationStatus === "review").length;
  const promotedCount = rows.filter((row) => row.promotedToApplicationId !== null).length;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Leads monitorados
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Triagem das vagas descobertas automaticamente antes de virarem candidatura.
          </p>
        </div>

        <MonitoringRunButton
          action={runAllCompaniesMonitoring}
          label="Rodar radar completo"
          pendingLabel="Rodando radar..."
          className="h-11 rounded-xl bg-amber-300 px-6 text-zinc-950 hover:bg-amber-200"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Leads ativos"
          value={String(rows.length)}
          icon={ScanSearch}
          className="border-sky-400/20 bg-sky-400/8"
        />
        <StatCard
          label="Para revisar"
          value={String(reviewCount)}
          icon={Radar}
          className="border-amber-400/20 bg-amber-400/8"
        />
        <StatCard
          label="Promovidas"
          value={String(promotedCount)}
          icon={BriefcaseBusiness}
          className="border-emerald-400/20 bg-emerald-400/8"
        />
        <StatCard
          label="Empresas"
          value={String(new Set(rows.map((row) => row.companyId)).size)}
          icon={Building2}
          className="border-violet-400/20 bg-violet-400/8"
        />
      </div>

      {rows.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed border-border/50 bg-card/40 py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScanSearch />
            </EmptyMedia>
            <EmptyTitle>Nenhum lead salvo ainda</EmptyTitle>
            <EmptyDescription>
              Rode a varredura a partir das empresas em monitoramento para encher esta caixa de triagem.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/companies"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
            >
              <ArrowUpRight data-icon="inline-start" />
              Ir para empresas
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((lead) => {
            const discardAction = discardLead.bind(null, lead.id);
            const promoteAction = promoteLeadToApplication.bind(null, lead.id);

            return (
              <Card
                key={lead.id}
                className="border-border/60 bg-card/85 shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
              >
                <CardHeader className="gap-4 border-b border-border/40 pb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl leading-7 text-balance">
                        {lead.title}
                      </CardTitle>
                      <CardDescription className="mt-1 text-sm leading-6 text-muted-foreground">
                        {lead.companyName}
                      </CardDescription>
                    </div>
                    <LeadStatusBadge status={lead.classificationStatus} />
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {lead.classificationScore !== null ? (
                      <span>Score {lead.classificationScore}</span>
                    ) : null}
                    {lead.seniority ? <span>{formatSeniority(lead.seniority)}</span> : null}
                    {lead.workModel ? <span>{formatWorkModel(lead.workModel)}</span> : null}
                    {lead.locationText ? <span>{lead.locationText}</span> : null}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-5 pt-5">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {lead.classificationReason || "Sem justificativa resumida."}
                  </p>

                  {lead.description ? (
                    <p className="line-clamp-5 text-sm leading-6 text-foreground/80">
                      {lead.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Fonte: {formatSourceName(lead.sourceName)}</span>
                    {lead.salaryText ? <span>Faixa: {lead.salaryText}</span> : null}
                    <span>Atualizada em {formatDate(lead.updatedAt)}</span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
                    >
                      <ExternalLink data-icon="inline-start" />
                      Abrir vaga
                    </Link>

                    {lead.promotedToApplicationId ? (
                      <>
                        <Link
                          href={`/applications#application-card-${lead.promotedToApplicationId}`}
                          className={cn(buttonVariants(), "rounded-xl")}
                        >
                          <BriefcaseBusiness data-icon="inline-start" />
                          Ver candidatura criada
                        </Link>
                        <span className="inline-flex items-center rounded-xl border border-emerald-400/20 bg-emerald-400/8 px-3 text-sm text-emerald-100">
                          Feedback positivo registrado
                        </span>
                      </>
                    ) : (
                      <>
                        <form action={promoteAction}>
                          <FormSubmitButton pendingLabel="Criando..." className="rounded-xl">
                            <BriefcaseBusiness data-icon="inline-start" />
                            Criar candidatura
                          </FormSubmitButton>
                        </form>

                        <form action={discardAction}>
                          <FormSubmitButton
                            pendingLabel="Descartando..."
                            variant="outline"
                            className="rounded-xl"
                          >
                            Descartar
                          </FormSubmitButton>
                        </form>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  className,
  icon: Icon,
  label,
  value,
}: {
  className: string;
  icon: typeof Radar;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <Icon className="size-3.5 shrink-0 text-foreground/70" />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function formatDate(date: Date | null) {
  if (!date) {
    return "sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatSourceName(value: string) {
  switch (value) {
    case "gupy":
      return "Gupy";
    case "linkedin":
      return "LinkedIn";
    case "company_site":
      return "Site da empresa";
    default:
      return "Outra origem";
  }
}

function formatWorkModel(value: string) {
  switch (value) {
    case "remote":
      return "Remoto";
    case "hybrid":
      return "Híbrido";
    case "onsite":
      return "Presencial";
    default:
      return value;
  }
}

function formatSeniority(value: string) {
  switch (value) {
    case "intern":
      return "Estágio";
    case "junior":
      return "Júnior";
    case "mid":
      return "Pleno";
    case "senior":
      return "Sênior";
    case "staff":
      return "Staff";
    case "lead":
      return "Lead";
    default:
      return value;
  }
}
