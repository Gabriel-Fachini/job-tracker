import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { Building2, Plus } from "lucide-react";

import type { CompanyFormValues } from "@/components/companies/company-form";
import { CompanyLogo } from "@/components/companies/company-logo";
import { CompanyRowActions } from "@/components/companies/company-row-actions";
import {
  CompanyStatusBadge,
  companyStatusColor,
} from "@/components/companies/company-status-badge";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { MetaLine } from "@/components/ui/meta-line";
import { Tag } from "@/components/ui/tag";
import {
  getCompanySizeLabel,
  isCompanyStatus,
  isMonitorableJobsBoardUrl,
  radarSkippedCompanyStatuses,
  type CompanyStatus,
} from "@/lib/companies";
import { getCompanyLogoView, type CompanyLogoView } from "@/lib/company-logos";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { runAllCompaniesMonitoring } from "@/server/actions/job-monitoring";

export const dynamic = "force-dynamic";

type CompanyListItem = {
  id: number;
  name: string;
  status: string;
  sector: string | null;
  size: string | null;
  website: string | null;
  updatedAt: Date | null;
  applicationsCount: number;
  jobsCount: number;
  leadsCount: number;
  logo: CompanyLogoView;
  formValues: CompanyFormValues;
};

function CompanyRow({ item }: { item: CompanyListItem }) {
  const sizeLabel = getCompanySizeLabel(item.size);
  const hasApplications = item.applicationsCount > 0;

  return (
    <li className="group relative transition-colors duration-150 hover:bg-surface has-[a[data-row-link]:active]:bg-surface">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-x-3 px-4 py-3.5 sm:px-5 lg:grid-cols-[2.5rem_minmax(0,1fr)_7rem_5.5rem_auto] lg:items-center lg:gap-x-5">
        <CompanyLogo
          name={item.name}
          {...item.logo}
          className="col-start-1 row-span-3 row-start-1 self-start lg:self-center"
        />

        <h2 className="col-start-2 row-start-1 min-w-0 text-[15px] leading-snug font-medium break-words text-foreground">
          {/* Stretched link: the whole row opens the company. */}
          <Link
            href={`/companies/${item.id}`}
            data-row-link
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          >
            {item.name}
          </Link>
        </h2>

        {/* lg:col-span-1 is the grid-column shorthand: restate the start after it. */}
        <p className="col-span-2 col-start-2 row-start-2 mt-0.5 truncate text-[13px] text-subtle-foreground lg:col-span-1 lg:col-start-2">
          {item.website ? readableUrl(item.website) : "Sem site registrado"}
        </p>

        <MetaLine
          className="col-span-2 col-start-2 row-start-3 mt-1.5 lg:col-span-1 lg:col-start-2"
          items={[
            item.sector || (
              <span key="sector" className="text-subtle-foreground">
                Setor não informado
              </span>
            ),
            sizeLabel,
            <span key="applications">
              <span className={cn("font-data", hasApplications && "text-foreground")}>
                {item.applicationsCount}
              </span>{" "}
              {item.applicationsCount === 1 ? "candidatura" : "candidaturas"}
            </span>,
          ]}
        />

        {/* Beside the name on phones; from lg its children become fixed
            columns so statuses, dates and actions line up down the list. */}
        <div className="col-start-3 row-start-1 flex items-center gap-3 self-start lg:contents">
          {isCompanyStatus(item.status) ? (
            <CompanyStatusBadge
              status={item.status}
              className="lg:col-start-3 lg:row-span-3 lg:row-start-1 lg:justify-self-start"
            />
          ) : null}
          {item.updatedAt ? (
            <time
              dateTime={item.updatedAt.toISOString()}
              // md has the sidebar and a narrow row: the name needs the room more.
              className="hidden font-data text-xs text-subtle-foreground sm:block md:hidden lg:col-start-4 lg:row-span-3 lg:row-start-1 lg:block lg:text-right"
            >
              <span className="sr-only">Atualizada em </span>
              {formatDate(item.updatedAt)}
            </time>
          ) : null}
          <CompanyRowActions
            company={{
              id: item.id,
              name: item.name,
              status: item.status,
              website: item.website,
              logo: item.logo,
              applicationsCount: item.applicationsCount,
              leadsCount: item.leadsCount,
              canDelete: item.jobsCount === 0,
            }}
            values={item.formValues}
            className="-my-1 lg:col-start-5 lg:row-span-3 lg:row-start-1 lg:my-0"
          />
        </div>
      </div>
    </li>
  );
}

export default async function CompaniesPage() {
  const rows: CompanyListItem[] = db
    .select({
      id: companies.id,
      name: companies.name,
      status: companies.status,
      sector: companies.sector,
      size: companies.size,
      website: companies.website,
      jobsBoardUrl: companies.jobsBoardUrl,
      jobBoardNavigationMode: companies.jobBoardNavigationMode,
      atsProvider: companies.atsProvider,
      glassdoorUrl: companies.glassdoorUrl,
      notes: companies.notes,
      logoUrl: companies.logoUrl,
      logoPath: companies.logoPath,
      logoCheckedAt: companies.logoCheckedAt,
      updatedAt: companies.updatedAt,
      // Spelled out: in a single-table select drizzle leaves column names
      // unqualified, which makes correlated subqueries ambiguous.
      applicationsCount: sql<number>`(select count(*) from applications a inner join jobs j on a.job_id = j.id where j.company_id = companies.id)`,
      // Any job blocks deleting; leads go with the company.
      jobsCount: sql<number>`(select count(*) from jobs j where j.company_id = companies.id)`,
      leadsCount: sql<number>`(select count(*) from job_leads l where l.company_id = companies.id)`,
    })
    .from(companies)
    .orderBy(desc(companies.updatedAt))
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      sector: row.sector,
      size: row.size,
      website: row.website,
      updatedAt: row.updatedAt,
      applicationsCount: Number(row.applicationsCount ?? 0),
      jobsCount: Number(row.jobsCount ?? 0),
      leadsCount: Number(row.leadsCount ?? 0),
      logo: getCompanyLogoView(row),
      // Everything the row's edit sheet opens with, so it opens instantly.
      formValues: {
        name: row.name,
        website: row.website ?? "",
        sector: row.sector ?? "",
        size: row.size ?? "",
        jobsBoardUrl: row.jobsBoardUrl ?? "",
        jobBoardNavigationMode: row.jobBoardNavigationMode ?? "fetch",
        atsProvider: row.atsProvider,
        glassdoorUrl: row.glassdoorUrl ?? "",
        logoUrl: row.logoUrl ?? "",
        status: row.status,
        notes: row.notes ?? "",
      },
    }));

  const totalCompanies = rows.length;
  const hasCompanies = totalCompanies > 0;
  const monitoringCount = rows.filter((row) => row.status === "monitoring").length;
  const inProcessCount = rows.filter((row) => row.status === "in_process").length;
  const discardedCount = rows.filter((row) => row.status === "discarded").length;
  const blacklistedCount = rows.filter((row) => row.status === "blacklist").length;
  // Same rule as the bulk scan: a job board and a status still being followed.
  const radarCount = rows.filter(
    (row) =>
      isMonitorableJobsBoardUrl(row.formValues.jobsBoardUrl) &&
      isCompanyStatus(row.status) &&
      !radarSkippedCompanyStatuses.includes(row.status),
  ).length;
  const totalLinkedApplications = rows.reduce(
    (accumulator, row) => accumulator + row.applicationsCount,
    0,
  );

  const statusSummary: Array<{ status: CompanyStatus; count: number; label: string }> = [
    { status: "in_process", count: inProcessCount, label: "em processo" },
    { status: "monitoring", count: monitoringCount, label: "monitorando" },
    {
      status: "discarded",
      count: discardedCount,
      label: discardedCount === 1 ? "descartada" : "descartadas",
    },
    { status: "blacklist", count: blacklistedCount, label: "blacklist" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Empresas"
        description={
          hasCompanies ? (
            <>
              <span className="font-data text-foreground">{totalCompanies}</span>{" "}
              {totalCompanies === 1 ? "empresa" : "empresas"}
              <span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>
              <span className="font-data text-foreground">{totalLinkedApplications}</span>{" "}
              {totalLinkedApplications === 1 ? "candidatura" : "candidaturas"}
              <span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>
              <span className="font-data text-foreground">{radarCount}</span> no radar
            </>
          ) : undefined
        }
        actions={
          // With no companies the empty state carries the only action.
          hasCompanies ? (
            // Capped on phones so a live radar's extra Cancel button wraps
            // onto a second line instead of squeezing the title.
            <div className="flex flex-wrap items-center justify-end gap-2 max-sm:max-w-[calc(100vw-9.5rem)]">
              <MonitoringRunButton
                action={runAllCompaniesMonitoring}
                label="Rodar varredura"
                shortLabel="Varredura"
                pendingLabel="Varrendo…"
                variant="outline"
              />
              <Link href="/companies/new" className={buttonVariants()}>
                <Plus data-icon="inline-start" />
                <span className="sm:hidden">Nova</span>
                <span className="hidden sm:inline">Nova empresa</span>
              </Link>
            </div>
          ) : undefined
        }
      />

      <section
        aria-label="Lista de empresas"
        className="-mx-4 overflow-hidden border-y border-border sm:mx-0 sm:rounded-xl sm:border-x"
      >
        {hasCompanies ? (
          <>
            <div className="flex min-h-11 items-center border-b border-border px-4 py-2.5 sm:px-5">
              <ul
                aria-label="Empresas por status"
                className="flex flex-wrap items-center gap-1.5"
              >
                {statusSummary.map((item) => (
                  <li key={item.status}>
                    <Tag variant="status" color={companyStatusColor[item.status]}>
                      <span className="font-data">{item.count}</span> {item.label}
                    </Tag>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <CompanyRow key={row.id} item={row} />
              ))}
            </ul>
          </>
        ) : (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>Nenhuma empresa registrada</EmptyTitle>
              <EmptyDescription>
                Comece pelas empresas que você quer observar com calma, mesmo antes
                de existir uma vaga ativa.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/companies/new" className={buttonVariants()}>
                <Plus data-icon="inline-start" />
                Cadastrar primeira empresa
              </Link>
            </EmptyContent>
          </Empty>
        )}
      </section>
    </div>
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
