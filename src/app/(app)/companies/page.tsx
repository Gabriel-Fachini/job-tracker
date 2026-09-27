import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Building2, ChevronRight, Plus } from "lucide-react";

import {
  CompanyStatusBadge,
  companyStatusTone,
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
import { Status } from "@/components/ui/status";
import {
  getCompanySizeLabel,
  isCompanyStatus,
  type CompanyStatus,
} from "@/lib/companies";
import { db } from "@/lib/db";
import { applications, companies, jobs } from "@/lib/db/schema";
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
};

function CompanyRow({ item }: { item: CompanyListItem }) {
  const sizeLabel = getCompanySizeLabel(item.size);
  const hasApplications = item.applicationsCount > 0;

  return (
    <li className="group relative transition-colors duration-150 hover:bg-surface has-[a:active]:bg-surface">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_7rem_5.5rem_1rem] lg:items-center lg:gap-x-6">
        <h2 className="col-start-1 row-start-1 min-w-0 text-[15px] leading-snug font-medium break-words text-foreground">
          {/* Stretched link: the whole row opens the company. */}
          <Link
            href={`/companies/${item.id}`}
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          >
            {item.name}
          </Link>
        </h2>

        <p className="col-span-2 col-start-1 row-start-2 mt-0.5 truncate text-[13px] text-subtle-foreground lg:col-span-1">
          {item.website ? readableUrl(item.website) : "Sem site registrado"}
        </p>

        <MetaLine
          className="col-span-2 col-start-1 row-start-3 mt-1.5 lg:col-span-1"
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
            columns so statuses and dates line up down the list. */}
        <div className="col-start-2 row-start-1 flex items-center gap-3 self-start pt-0.5 lg:contents">
          {isCompanyStatus(item.status) ? (
            <CompanyStatusBadge
              status={item.status}
              className="lg:col-start-2 lg:row-span-3 lg:row-start-1"
            />
          ) : null}
          {item.updatedAt ? (
            <time
              dateTime={item.updatedAt.toISOString()}
              className="hidden font-data text-xs text-subtle-foreground sm:block lg:col-start-3 lg:row-span-3 lg:row-start-1 lg:text-right"
            >
              <span className="sr-only">Atualizada em </span>
              {formatDate(item.updatedAt)}
            </time>
          ) : null}
          <ChevronRight
            aria-hidden
            className="size-4 text-subtle-foreground transition-colors duration-150 group-hover:text-foreground lg:col-start-4 lg:row-span-3 lg:row-start-1"
          />
        </div>
      </div>
    </li>
  );
}

export default async function CompaniesPage() {
  const rows = db
    .select({
      id: companies.id,
      name: companies.name,
      status: companies.status,
      sector: companies.sector,
      size: companies.size,
      website: companies.website,
      updatedAt: companies.updatedAt,
      applicationsCount: sql<number>`count(distinct ${applications.id})`,
    })
    .from(companies)
    .leftJoin(jobs, eq(jobs.companyId, companies.id))
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .groupBy(companies.id)
    .orderBy(desc(companies.updatedAt))
    .all()
    .map((row) => ({
      ...row,
      applicationsCount: Number(row.applicationsCount ?? 0),
    }));

  const totalCompanies = rows.length;
  const hasCompanies = totalCompanies > 0;
  const monitoringCount = rows.filter((row) => row.status === "monitoring").length;
  const inProcessCount = rows.filter((row) => row.status === "in_process").length;
  const discardedCount = rows.filter((row) => row.status === "discarded").length;
  const blacklistedCount = rows.filter((row) => row.status === "blacklist").length;
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
                className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
              >
                {statusSummary.map((item) => (
                  <li key={item.status}>
                    <Status tone={companyStatusTone[item.status]}>
                      <span className={cn("font-data", item.count > 0 && "text-foreground")}>
                        {item.count}
                      </span>{" "}
                      {item.label}
                    </Status>
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
