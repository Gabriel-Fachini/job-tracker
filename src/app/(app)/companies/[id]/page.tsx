import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowUpRight, ChevronLeft, Radar, Waypoints } from "lucide-react";
import { notFound } from "next/navigation";

import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { CompanyLogo } from "@/components/companies/company-logo";
import { DiscoverAtsButton } from "@/components/companies/discover-ats-button";
import { CompanyRadarToggle } from "@/components/companies/company-radar-toggle";
import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { EditCompanySheet } from "@/components/companies/edit-company-sheet";
import { GlassdoorSection } from "@/components/glassdoor/glassdoor-section";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/ui/tag";
import { getCompanyOriginLabel } from "@/lib/companies/company-origin";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelMeta,
  PanelTitle,
} from "@/components/ui/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isApplicationStatus } from "@/lib/applications";
import {
  getCompanyJobBoardNavigationModeLabel,
  getCompanySizeLabel,
  getCompanyStatusLabel,
  isCompanyStatus,
  isMonitorableJobsBoardUrl,
  radarSkippedCompanyStatuses,
} from "@/lib/companies";
import { getCompanyLogoView } from "@/lib/company-logos";
import { db } from "@/lib/db";
import { applications, companies, jobLeads, jobs } from "@/lib/db/schema";
import { getGlassdoorView } from "@/lib/glassdoor/queries";
import { cn } from "@/lib/utils";
import { runCompanyMonitoring } from "@/server/actions/job-monitoring";

type CompanyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = await params;
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
  // Any job blocks deleting; leads go with the company.
  const jobsCount = Number(
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.companyId, company.id))
      .get()?.count ?? 0,
  );
  const leadsCount = Number(
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobLeads)
      .where(eq(jobLeads.companyId, company.id))
      .get()?.count ?? 0,
  );
  const logo = getCompanyLogoView(company);
  const glassdoorView = getGlassdoorView(company.id);
  const boundRunMonitoringAction = runCompanyMonitoring.bind(null, company.id);

  const sizeLabel = getCompanySizeLabel(company.size);
  const facts: Array<{ label: string; value: string | null; href?: string | null }> = [
    { label: "Site", value: company.website, href: company.website },
    { label: "Setor", value: company.sector },
    { label: "Porte", value: sizeLabel },
    { label: "Job board", value: company.jobsBoardUrl, href: company.jobsBoardUrl },
    {
      label: "Navegação do board",
      value: getCompanyJobBoardNavigationModeLabel(company.jobBoardNavigationMode),
    },
    { label: "Glassdoor", value: company.glassdoorUrl, href: company.glassdoorUrl },
    { label: "Status atual", value: getCompanyStatusLabel(company.status) },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <PageHeader
        leading={
          <Link
            href="/companies"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            <ChevronLeft data-icon="inline-start" />
            Empresas
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <CompanyLogo name={company.name} {...logo} />
            <span className="min-w-0">{company.name}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {isCompanyStatus(company.status) ? (
              <>
                <CompanyStatusBadge status={company.status} />
                <MetaDot />
              </>
            ) : null}
            {sizeLabel ? (
              <>
                <span>{sizeLabel}</span>
                <MetaDot />
              </>
            ) : null}
            {company.origin !== "manual" ? (
              <>
                <Tag color={company.origin === "yc_import" ? "orange" : "blue"}>
                  {getCompanyOriginLabel(company.origin)}
                </Tag>
                <MetaDot />
              </>
            ) : null}
            <span>
              Atualizada{" "}
              <time dateTime={company.updatedAt.toISOString()} className="font-data">
                {formatDate(company.updatedAt)}
              </time>
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/leads?companyId=${company.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Radar data-icon="inline-start" />
              Ver leads
            </Link>
            {company.jobsBoardUrl ? null : (
              <DiscoverAtsButton companyId={company.id} companyName={company.name} />
            )}
            <MonitoringRunButton
              action={boundRunMonitoringAction}
              label="Rodar varredura"
              shortLabel="Varredura"
              pendingLabel="Varrendo…"
            />
          </div>
        }
        actionsPlacement="stacked"
      />

      <CompanyRadarToggle
        companyId={company.id}
        companyName={company.name}
        radarEnabled={company.radarEnabled}
        hasJobsBoardUrl={isMonitorableJobsBoardUrl(company.jobsBoardUrl)}
        isStatusSkipped={
          isCompanyStatus(company.status) && radarSkippedCompanyStatuses.includes(company.status)
        }
      />

      {company.notes ? (
        <p className="max-w-[68ch] text-sm leading-6 text-pretty whitespace-pre-line text-muted-foreground">
          {company.notes}
        </p>
      ) : (
        <p className="max-w-[68ch] text-sm leading-6 text-pretty text-subtle-foreground">
          Sem notas ainda. Registre aqui cultura, timing, impressões de entrevistas e
          sinais de mercado.
        </p>
      )}

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:items-start">
        <Panel className="overflow-hidden">
          <PanelHeader>
            <PanelTitle>Candidaturas associadas</PanelTitle>
            {relatedApplications.length > 0 ? (
              <PanelMeta>
                <span>
                  <span className="font-data text-muted-foreground">{openProcesses}</span>{" "}
                  {openProcesses === 1 ? "ativa" : "ativas"} de{" "}
                  <span className="font-data text-muted-foreground">
                    {relatedApplications.length}
                  </span>
                </span>
              </PanelMeta>
            ) : null}
          </PanelHeader>

          {relatedApplications.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Waypoints />
                </EmptyMedia>
                <EmptyTitle>Nenhuma candidatura vinculada</EmptyTitle>
                <EmptyDescription>
                  Esta empresa já pode ser acompanhada por interesse, mas ainda não
                  existe processo salvo com ela.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href="/applications" className={buttonVariants({ variant: "outline" })}>
                  Ir para candidaturas
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              {/* Rows below lg; the table needs the width it gets from lg up. */}
              <ul className="divide-y divide-border lg:hidden">
                {relatedApplications.map((application) => {
                  const workModel = formatWorkModel(application.workModel);

                  return (
                    <li key={application.applicationId}>
                      <Link
                        href={`/applications?applicationId=${application.applicationId}`}
                        className="flex flex-col gap-1 px-4 py-3.5 outline-none transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-surface sm:px-5"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0 text-sm leading-snug font-medium break-words text-foreground">
                            {application.title}
                          </span>
                          {isApplicationStatus(application.status) ? (
                            <span className="shrink-0 pt-px">
                              <ApplicationStatusBadge status={application.status} />
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          {workModel ? (
                            <>
                              {workModel}
                              <span aria-hidden className="mx-1.5 text-subtle-foreground">
                                ·
                              </span>
                            </>
                          ) : null}
                          Atualizada{" "}
                          <time
                            dateTime={application.updatedAt.toISOString()}
                            className="font-data"
                          >
                            {formatDate(application.updatedAt)}
                          </time>
                        </span>
                        {application.notes ? (
                          <span className="line-clamp-2 text-[13px] leading-5 text-pretty text-muted-foreground">
                            {application.notes}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Vaga</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Atualizada</TableHead>
                      <TableHead className="pr-5">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedApplications.map((application) => {
                      const workModel = formatWorkModel(application.workModel);

                      return (
                        <TableRow key={application.applicationId}>
                          <TableCell className="pl-5 whitespace-normal">
                            <div className="flex min-w-0 flex-col gap-0.5">
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
                            {isApplicationStatus(application.status) ? (
                              <ApplicationStatusBadge status={application.status} />
                            ) : null}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-[13px]",
                              workModel ? "text-muted-foreground" : "text-subtle-foreground",
                            )}
                          >
                            {workModel ?? "Não informado"}
                          </TableCell>
                          <TableCell className="font-data text-xs text-muted-foreground">
                            <time dateTime={application.updatedAt.toISOString()}>
                              {formatDate(application.updatedAt)}
                            </time>
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Link
                              href={`/applications?applicationId=${application.applicationId}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                                "-mr-2.5",
                              )}
                            >
                              Abrir
                              <span className="sr-only">: {application.title}</span>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Ficha da empresa</PanelTitle>
            {/* Negative margins keep the header at the same height as its neighbor. */}
            <div className="-my-2 -mr-2">
              <EditCompanySheet
                company={{
                  id: company.id,
                  name: company.name,
                  status: company.status,
                  applicationsCount: relatedApplications.length,
                  leadsCount,
                  canDelete: jobsCount === 0,
                }}
                logo={logo}
                redirectAfterDelete
                values={{
                  name: company.name,
                  website: company.website ?? "",
                  sector: company.sector ?? "",
                  size: company.size ?? "",
                  jobsBoardUrl: company.jobsBoardUrl ?? "",
                  jobBoardNavigationMode: company.jobBoardNavigationMode ?? "fetch",
                  atsProvider: company.atsProvider,
                  glassdoorUrl: company.glassdoorUrl ?? "",
                  logoUrl: company.logoUrl ?? "",
                  status: company.status,
                  notes: company.notes ?? "",
                }}
              />
            </div>
          </PanelHeader>
          <PanelBody>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-1">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-xs text-subtle-foreground">{fact.label}</dt>
                  <dd
                    className={cn(
                      "mt-1 text-sm break-words text-foreground",
                      !fact.value && "text-subtle-foreground",
                    )}
                  >
                    {fact.value && fact.href ? (
                      <a
                        href={fact.href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-4 hover:underline focus-visible:underline"
                      >
                        {readableUrl(fact.value)}
                        <ArrowUpRight
                          aria-hidden
                          className="ml-0.5 inline size-3.5 align-[-0.125em] text-subtle-foreground"
                        />
                      </a>
                    ) : (
                      fact.value || "Não informado"
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </PanelBody>
        </Panel>
      </div>

      <GlassdoorSection view={glassdoorView} glassdoorUrl={company.glassdoorUrl} />
    </div>
  );
}

function MetaDot() {
  return (
    <span aria-hidden className="text-subtle-foreground">
      ·
    </span>
  );
}

function readableUrl(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

function formatDate(date: Date) {
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
      return null;
  }
}
