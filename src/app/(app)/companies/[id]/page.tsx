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

import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { EditCompanySheet } from "@/components/companies/edit-company-sheet";
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
    <div className="flex flex-1 flex-col gap-5 sm:gap-8">
      <div className="flex flex-col gap-3 sm:gap-4">
        <Link
          href="/companies"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 w-fit rounded-lg text-muted-foreground",
          )}
        >
          <ChevronLeft data-icon="inline-start" />
          Empresas
        </Link>

        <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(18,18,20,0.92))] p-4 sm:rounded-[2rem] sm:p-7 lg:p-9">
          <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px] xl:items-end">
            <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {isCompanyStatus(company.status) ? (
                  <CompanyStatusBadge status={company.status} />
                ) : null}
                <span className="text-xs text-zinc-400">
                  {getCompanySizeLabel(company.size) || "Porte não informado"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-tight break-words text-balance text-white sm:text-4xl lg:text-5xl">
                  {company.name}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-pretty text-zinc-300 sm:text-base sm:leading-7">
                  {company.notes ||
                    "Sem notas ainda. Registre aqui cultura, timing, impressões de entrevistas e sinais de mercado."}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-white/8 rounded-2xl border border-white/8 bg-black/25 xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
              <StatPanel
                icon={Radar}
                label="Candidaturas"
                value={String(relatedApplications.length)}
              />
              <StatPanel
                icon={BriefcaseBusiness}
                label="Fluxos ativos"
                value={String(openProcesses)}
              />
              <StatPanel
                icon={Clock3}
                label="Atualizada"
                value={formatShortDate(company.updatedAt)}
              />
            </dl>
          </div>
        </section>
      </div>

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="border-border/60 bg-card/85">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="font-heading text-lg sm:text-xl">
              Candidaturas associadas
            </CardTitle>
            <CardDescription className="text-sm text-pretty text-muted-foreground">
              Tudo que já toca esta empresa, como contexto operacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            {relatedApplications.length === 0 ? (
              <Empty className="py-12">
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
              <>
                <ul className="divide-y divide-border/40 md:hidden">
                  {relatedApplications.map((application) => (
                    <li key={application.applicationId} className="relative">
                      <Link
                        href={`/applications?applicationId=${application.applicationId}`}
                        className="flex flex-col gap-1.5 px-4 py-3.5 transition-colors active:bg-foreground/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 text-sm leading-snug font-medium break-words text-foreground">
                            {application.title}
                          </span>
                          {application.status && isApplicationStatus(application.status) ? (
                            <ApplicationStatusBadge status={application.status} />
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatWorkModel(application.workModel)} · atualizada em{" "}
                          {formatDate(application.updatedAt)}
                        </span>
                        {application.notes ? (
                          <span className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {application.notes}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="hidden px-2 md:block">
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
                              href={`/applications?applicationId=${application.applicationId}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                                "justify-end",
                              )}
                            >
                              Abrir
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="font-heading text-lg sm:text-xl">
                  Ficha da empresa
                </CardTitle>
                <CardDescription className="text-sm text-pretty text-muted-foreground">
                  Links, board monitorado e status atual.
                </CardDescription>
              </div>
              <EditCompanySheet
                action={boundUpdateAction}
                deleteAction={boundDeleteAction}
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
                hasValidationError={hasValidationError}
                hasLinkedApplicationsError={hasLinkedApplicationsError}
                canDelete={relatedApplications.length === 0}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-1">
            <dl className="divide-y divide-border/40">
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
            </dl>
            <div className="grid gap-2 sm:grid-cols-2">
              <MonitoringRunButton
                action={boundRunMonitoringAction}
                label="Rodar varredura"
                pendingLabel="Varrendo…"
                className="h-11 w-full rounded-xl"
              />
              <Link
                href={`/leads?companyId=${company.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 w-full rounded-xl")}
              >
                <ArrowUpRight data-icon="inline-start" />
                Ver leads desta empresa
              </Link>
            </div>
          </CardContent>
        </Card>
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

function formatShortDate(date: Date | null) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
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
    <div className="flex min-w-0 flex-col-reverse items-center gap-1 px-2 py-3 text-center xl:flex-row-reverse xl:items-center xl:justify-between xl:gap-3 xl:px-4 xl:py-3.5 xl:text-left">
      <dt className="flex max-w-full items-center gap-1.5 truncate text-[11px] text-zinc-400 xl:text-xs">
        <Icon aria-hidden className="hidden size-3.5 shrink-0 xl:block" />
        {label}
      </dt>
      <dd className="text-xl leading-none font-semibold text-white tabular-nums sm:text-2xl">
        {value}
      </dd>
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
    <div className="flex items-start gap-3 py-3">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
        <dd className="min-w-0 text-sm font-medium text-foreground sm:text-right">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="break-all underline-offset-4 hover:underline"
            >
              {value.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span className="break-words">{value}</span>
          )}
        </dd>
      </div>
    </div>
  );
}
