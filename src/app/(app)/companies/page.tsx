import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Globe2,
  Plus,
  Radar,
  ScanSearch,
  ShieldBan,
  Waypoints,
} from "lucide-react";

import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { getCompanySizeLabel, isCompanyStatus } from "@/lib/companies";
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

function CompanyCard({ item }: { item: CompanyListItem }) {
  const sizeLabel = getCompanySizeLabel(item.size);
  const hasApplications = item.applicationsCount > 0;

  return (
    <article className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors duration-150 hover:border-border has-[a:active]:bg-card/70 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base leading-snug font-semibold break-words text-foreground sm:text-lg">
            {/* Stretched link: the whole card opens the company. */}
            <Link
              href={`/companies/${item.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {item.name}
            </Link>
          </h3>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Globe2 aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              {item.website ? readableUrl(item.website) : "Sem site registrado"}
            </span>
          </p>
        </div>
        {isCompanyStatus(item.status) ? (
          <CompanyStatusBadge status={item.status} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip tone={item.sector ? "neutral" : "muted"}>
          {item.sector || "Setor não informado"}
        </Chip>
        {sizeLabel ? <Chip>{sizeLabel}</Chip> : null}
        <Chip tone={hasApplications ? "info" : "muted"}>
          <BriefcaseBusiness aria-hidden />
          {item.applicationsCount === 1
            ? "1 candidatura"
            : `${item.applicationsCount} candidaturas`}
        </Chip>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <span>Atualizada em {formatDate(item.updatedAt)}</span>
        <span className="flex items-center gap-0.5 font-medium text-foreground/70 transition-colors group-hover:text-foreground">
          Ver painel
          <ChevronRight aria-hidden className="size-3.5" />
        </span>
      </div>
    </article>
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
  const monitoringCount = rows.filter((row) => row.status === "monitoring").length;
  const inProcessCount = rows.filter((row) => row.status === "in_process").length;
  const discardedCount = rows.filter((row) => row.status === "discarded").length;
  const blacklistedCount = rows.filter((row) => row.status === "blacklist").length;
  const totalLinkedApplications = rows.reduce(
    (accumulator, row) => accumulator + row.applicationsCount,
    0,
  );

  const statCards = [
    {
      label: "Monitorando",
      count: monitoringCount,
      icon: Waypoints,
      colorClass: "border-amber-400/20 bg-amber-400/8",
      iconClass: "text-amber-300/80",
      textClass: "text-amber-100",
    },
    {
      label: "Em processo",
      count: inProcessCount,
      icon: Radar,
      colorClass: "border-violet-400/20 bg-violet-400/8",
      iconClass: "text-violet-300/80",
      textClass: "text-violet-100",
    },
    {
      label: "Descartadas",
      count: discardedCount,
      icon: ScanSearch,
      colorClass: "border-sky-400/20 bg-sky-400/8",
      iconClass: "text-sky-300/80",
      textClass: "text-sky-100",
    },
    {
      label: "Blacklist",
      count: blacklistedCount,
      icon: ShieldBan,
      colorClass: "border-rose-400/20 bg-rose-400/8",
      iconClass: "text-rose-300/80",
      textClass: "text-rose-100",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-8">
      <PageHeader
        title="Empresas"
        description="Organizações que valem acompanhamento antes, durante e depois das candidaturas."
        actions={
          <Link
            href="/companies/new"
            className={cn(
              buttonVariants({ variant: "brand", size: "lg" }),
              "h-10 rounded-xl px-4 sm:h-11 sm:px-5",
            )}
          >
            <Plus data-icon="inline-start" />
            <span className="sm:hidden">Nova</span>
            <span className="hidden sm:inline">Nova empresa</span>
          </Link>
        }
      />

      {/* Compact status strip on phones; roomier cards from md up. */}
      <dl className="grid grid-cols-4 divide-x divide-border/60 rounded-2xl border border-border/60 bg-card/50 md:hidden">
        {statCards.map(({ label, count, textClass }) => (
          <div key={label} className="flex min-w-0 flex-col-reverse items-center gap-1 px-1 py-3">
            <dt className="max-w-full truncate text-[11px] text-muted-foreground">{label}</dt>
            <dd className={cn("text-xl leading-none font-semibold tabular-nums", textClass)}>
              {count}
            </dd>
          </div>
        ))}
      </dl>

      <div className="hidden gap-3 md:grid md:grid-cols-4">
        {statCards.map(({ label, count, icon: Icon, colorClass, iconClass, textClass }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-2xl border p-4 ${colorClass}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {label}
              </p>
              <Icon className={`size-3.5 shrink-0 ${iconClass}`} />
            </div>
            <p className={`mt-3 text-3xl font-semibold tabular-nums ${textClass}`}>
              {count}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {totalCompanies === 0
            ? "Nenhuma empresa registrada ainda"
            : `${totalCompanies === 1 ? "1 empresa" : `${totalCompanies} empresas`} · ${
                totalLinkedApplications === 1
                  ? "1 candidatura conectada"
                  : `${totalLinkedApplications} candidaturas conectadas`
              }`}
        </p>

        <div className="flex items-center gap-2">
          <MonitoringRunButton
            action={runAllCompaniesMonitoring}
            label="Rodar varredura"
            pendingLabel="Varrendo…"
            variant="outline"
            className="rounded-xl"
          />
          <Link
            href="/leads"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden rounded-xl md:inline-flex")}
          >
            <Radar data-icon="inline-start" />
            Ver leads
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border/50 bg-card/40 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
            <Building2 className="size-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-medium text-foreground/85">
              Nenhuma empresa registrada
            </p>
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              Comece pelas empresas que você quer observar com calma, mesmo antes
              de existir uma vaga ativa.
            </p>
          </div>
          <Link
            href="/companies/new"
            className={cn(buttonVariants({ variant: "brand" }), "h-10 rounded-xl px-5")}
          >
            <Building2 data-icon="inline-start" />
            Cadastrar primeira empresa
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0">
              <CompanyCard item={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function readableUrl(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
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
