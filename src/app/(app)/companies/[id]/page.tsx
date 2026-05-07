import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronLeft,
  Clock3,
  Globe,
  Radar,
  ScanSearch,
} from "lucide-react";
import { notFound } from "next/navigation";

import { CompanyForm } from "@/components/companies/company-form";
import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { FormSubmitButton } from "@/components/companies/form-submit-button";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { isApplicationStatus } from "@/lib/applications";
import {
  getCompanyJobBoardNavigationModeLabel,
  getCompanySizeLabel,
  getCompanyStatusLabel,
  isCompanyStatus,
} from "@/lib/companies";
import { db } from "@/lib/db";
import { applications, companies, jobs } from "@/lib/db/schema";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteCompany, updateCompany } from "@/server/actions/companies";
import { runCompanyMonitoring } from "@/server/actions/job-monitoring";
import { cn } from "@/lib/utils";

type CompanyDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function CompanyDetailPage({
  params,
  searchParams,
}: CompanyDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const companyId = Number(id);

  if (!Number.isInteger(companyId)) {
    notFound();
  }

  const company = db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!company) {
    notFound();
  }

  const relatedApplications = db
    .select({
      applicationId: applications.id,
      status: applications.status,
      notes: applications.notes,
      appliedAt: applications.appliedAt,
      updatedAt: applications.updatedAt,
      title: jobs.title,
      sourceUrl: jobs.sourceUrl,
      workModel: jobs.workModel,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(jobs.companyId, company.id))
    .orderBy(desc(applications.updatedAt))
    .all();

  const openProcesses = relatedApplications.filter((application) =>
    ["applied", "in_process", "offer", "approved"].includes(application.status),
  ).length;
  const hasValidationError = query.error === "validation";
  const hasLinkedApplicationsError = query.error === "linked-applications";
  const boundUpdateAction = updateCompany.bind(null, company.id);
  const boundDeleteAction = deleteCompany.bind(null, company.id);
  const boundRunMonitoringAction = runCompanyMonitoring.bind(null, company.id);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/companies"
          className={cn(buttonVariants({ variant: "ghost" }), "w-fit rounded-xl")}
        >
          <ChevronLeft data-icon="inline-start" />
          Voltar para empresas
        </Link>

        <section className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(18,18,20,0.92))] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-9">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px] xl:items-end">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {isCompanyStatus(company.status) ? (
                  <CompanyStatusBadge status={company.status} />
                ) : null}
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-400">
                  {getCompanySizeLabel(company.size) || "Porte não informado"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                  {company.name}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-300">
                  {company.notes ||
                    "Sem notas salvas ainda. Use este espaço para registrar contexto de cultura, timing, impressão de entrevistas e sinais de mercado."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.75rem] border border-white/8 bg-black/20 p-4 backdrop-blur-sm">
              <StatPanel
                icon={Radar}
                label="Candidaturas ligadas"
                value={String(relatedApplications.length)}
              />
              <StatPanel
                icon={BriefcaseBusiness}
                label="Fluxos ativos"
                value={String(openProcesses)}
              />
              <StatPanel
                icon={Clock3}
                label="Última atualização"
                value={formatDate(company.updatedAt)}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="border-border/60 bg-card/85 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <CardHeader className="border-b border-border/40 pb-5">
            <CardTitle className="font-heading text-2xl">
              Candidaturas associadas
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              Tudo que já toca esta empresa aparece aqui como contexto operacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {relatedApplications.length === 0 ? (
              <Empty className="border border-dashed border-border/50 bg-background/30 py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ScanSearch />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma candidatura vinculada</EmptyTitle>
                  <EmptyDescription>
                    Esta empresa já pode ser acompanhada por interesse, mas
                    ainda não existe processo salvo com ela.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link
                    href="/applications"
                    className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
                  >
                    <ArrowUpRight data-icon="inline-start" />
                    Ir para candidaturas
                  </Link>
                </EmptyContent>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vaga</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Atualizada</TableHead>
                    <TableHead className="text-right">Acesso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedApplications.map((application) => (
                    <TableRow key={application.applicationId}>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground">
                            {application.title}
                          </span>
                          {application.notes ? (
                            <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {application.notes}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {application.status && isApplicationStatus(application.status) ? (
                          <ApplicationStatusBadge status={application.status} />
                        ) : null}
                      </TableCell>
                      <TableCell>{formatWorkModel(application.workModel)}</TableCell>
                      <TableCell>{formatDate(application.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/applications#application-card-${application.applicationId}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "justify-end",
                          )}
                        >
                          Abrir card
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border/60 bg-card/85 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
            <CardHeader className="border-b border-border/40 pb-5">
              <CardTitle className="font-heading text-2xl">
                Leitura atual
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                Um resumo rápido do que esta empresa representa no seu pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6">
              <SummaryRow
                icon={Globe}
                label="Site"
                value={company.website || "Não informado"}
                href={company.website}
              />
              <SummaryRow
                icon={BriefcaseBusiness}
                label="Setor"
                value={company.sector || "Não informado"}
              />
              <SummaryRow
                icon={ScanSearch}
                label="Job board"
                value={company.jobsBoardUrl || "Não informado"}
                href={company.jobsBoardUrl}
              />
              <SummaryRow
                icon={Radar}
                label="Navegação do board"
                value={
                  getCompanyJobBoardNavigationModeLabel(
                    company.jobBoardNavigationMode,
                  ) || "Não informado"
                }
              />
              <SummaryRow
                icon={Radar}
                label="Status atual"
                value={getCompanyStatusLabel(company.status) || "Não informado"}
              />
              <div className="flex flex-col gap-3 pt-2">
                <MonitoringRunButton
                  action={boundRunMonitoringAction}
                  label="Rodar varredura desta empresa"
                  pendingLabel="Rodando varredura..."
                  className="w-full rounded-xl"
                />
                <Link
                  href="/leads"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl")}
                >
                  <ArrowUpRight data-icon="inline-start" />
                  Abrir caixa de triagem
                </Link>
              </div>
            </CardContent>
          </Card>

          {hasValidationError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
              Não foi possível atualizar a empresa. Revise o nome e as URLs informadas.
            </div>
          ) : null}

          {hasLinkedApplicationsError ? (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
              Esta empresa não pode ser excluída porque ainda possui candidaturas vinculadas.
            </div>
          ) : null}

          <CompanyForm
            action={boundUpdateAction}
            cancelHref="/companies"
            title="Editar empresa"
            description="Atualize a ficha desta empresa sem perder o vínculo com as candidaturas que já estão associadas no banco local."
            submitLabel="Salvar ajustes"
            submitPendingLabel="Salvando ajustes..."
            values={{
              name: company.name,
              website: company.website ?? "",
              sector: company.sector ?? "",
              size: company.size ?? "",
              jobsBoardUrl: company.jobsBoardUrl ?? "",
              jobBoardNavigationMode: company.jobBoardNavigationMode ?? "fetch",
              glassdoorUrl: company.glassdoorUrl ?? "",
              status: company.status,
              notes: company.notes ?? "",
            }}
          />

          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-xl text-destructive">
                Zona de remoção
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-destructive/80">
                Como toda candidatura agora exige uma empresa associada, a exclusão
                só é permitida quando não existem candidaturas vinculadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={boundDeleteAction} className="flex justify-end">
                <FormSubmitButton
                  pendingLabel="Excluindo..."
                  variant="destructive"
                >
                  Excluir empresa
                </FormSubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatWorkModel(value: string | null) {
  switch (value) {
    case "remote":
      return "Remoto";
    case "hybrid":
      return "Híbrido";
    case "onsite":
      return "Presencial";
    default:
      return "Não informado";
  }
}

function StatPanel({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          {label}
        </span>
        <span className="text-2xl font-semibold text-white">{value}</span>
      </div>
      <Icon className="size-4 shrink-0 text-zinc-300" />
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  href?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/35 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-background/70">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="text-sm font-medium text-foreground">{value}</span>
        )}
      </div>
    </div>
  );
}
