import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Globe2,
  Radar,
  ScanSearch,
  ShieldBan,
  Waypoints,
} from "lucide-react";

import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCompanySizeLabel, isCompanyStatus } from "@/lib/companies";
import { db } from "@/lib/db";
import { applications, companies, jobs } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

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
    <Card className="relative overflow-hidden border border-border/60 bg-card transition-all duration-200 hover:border-border/90 hover:shadow-[0_8px_40px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-lg leading-snug text-foreground">
              {item.name}
            </CardTitle>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Globe2 className="size-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate text-sm text-muted-foreground">
                {item.website || "Sem site registrado"}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            {isCompanyStatus(item.status) ? (
              <CompanyStatusBadge status={item.status} />
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pb-4 pt-0">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <Building2 className="size-2.5" />
            {item.sector || "Setor não informado"}
          </span>
          {sizeLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/8 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-violet-300/80">
              <Radar className="size-2.5" />
              {sizeLabel}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]",
              hasApplications
                ? "border border-sky-400/20 bg-sky-400/8 text-sky-300/80"
                : "border border-border/60 bg-muted/20 text-muted-foreground",
            )}
          >
            <BriefcaseBusiness className="size-2.5" />
            {item.applicationsCount === 1
              ? "1 candidatura"
              : `${item.applicationsCount} candidaturas`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">
            Atualizada em {formatDate(item.updatedAt)}
          </span>
          <Link
            href={`/companies/${item.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "rounded-lg text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground/80",
            )}
          >
            Ver painel
            <ArrowUpRight data-icon="inline-end" className="size-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
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
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Empresas
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Centralize as organizações que valem acompanhamento antes, durante e
          depois das candidaturas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(({ label, count, icon: Icon, colorClass, iconClass, textClass }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${colorClass}`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
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

      <div className="h-px bg-border/40" />

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
            Radar de empresas
          </p>
          <p className="text-sm text-muted-foreground">
            {totalCompanies === 0
              ? "Nenhuma empresa registrada ainda"
              : totalCompanies === 1
                ? `1 empresa registrada · ${totalLinkedApplications} candidatura conectada`
                : `${totalCompanies} empresas registradas · ${totalLinkedApplications} candidaturas conectadas`}
          </p>
        </div>

        <Link
          href="/companies/new"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 min-w-44 justify-center rounded-xl bg-amber-300 px-6 text-zinc-950 shadow-[0_8px_28px_rgba(252,211,77,0.28)] transition-all hover:bg-amber-200 hover:shadow-[0_12px_36px_rgba(252,211,77,0.36)]",
          )}
        >
          <Building2 data-icon="inline-start" />
          Nova empresa
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border/50 bg-card/40 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
            <Building2 className="size-7 text-muted-foreground/50" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-medium text-foreground/80">
              Nenhuma empresa registrada
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Comece pelas empresas que você quer observar com calma, mesmo antes
              de existir uma vaga ativa.
            </p>
          </div>
          <Link
            href="/companies/new"
            className={cn(
              buttonVariants(),
              "mt-1 h-10 rounded-xl bg-amber-300 px-5 text-zinc-950 hover:bg-amber-200",
            )}
          >
            <Building2 data-icon="inline-start" />
            Cadastrar primeira empresa
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((row) => (
            <CompanyCard key={row.id} item={row} />
          ))}
        </div>
      )}
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
