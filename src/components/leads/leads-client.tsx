"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  ChevronDown,
  ExternalLink,
  MapPin,
  Radar,
  ScanSearch,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  ApplicationCreateModal,
  type ApplicationCreateInitialValues,
} from "@/components/applications/application-create-modal";
import { JobMarkdown } from "@/components/applications/job-markdown";
import { scoreTone, useLeadDecisions } from "@/components/leads/lead-decisions";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import type { LeadListItem, LeadTab } from "@/components/leads/types";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { MonitoringProgressDisplay } from "@/components/leads/monitoring-progress-display";
import { useMonitoringActions, useMonitoringProgress } from "@/components/leads/monitoring-progress-context";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";
import { getSeniorityLabel, getSourceNameLabel, getWorkModelLabel } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import { getLeads } from "@/server/actions/leads";
import { promoteApprovedLeadToApplication } from "@/server/actions/job-monitoring";

type LeadsClientProps = {
  companies: Array<{
    id: number;
    name: string;
  }>;
  items: LeadListItem[];
};

type ClassificationFilter = "interesting" | "review" | null;

const tabCopy: Record<
  LeadTab,
  { label: string; emptyTitle: string; emptyDescription: string }
> = {
  triage: {
    label: "Triagem",
    emptyTitle: "Nenhum lead pendente na triagem",
    emptyDescription:
      "Rode o radar para descobrir novas vagas ou ajuste os filtros ativos.",
  },
  approved: {
    label: "Aprovados",
    emptyTitle: "Nenhum lead aprovado ainda",
    emptyDescription:
      "Aprove os melhores leads na triagem para separá-los nesta fila.",
  },
};

const classificationOptions: Array<{ value: ClassificationFilter; label: string }> = [
  { value: null, label: "Todas" },
  { value: "interesting", label: "Interessantes" },
  { value: "review", label: "Revisar" },
];

export function LeadsClient({ companies, items }: LeadsClientProps) {
  const searchParams = useSearchParams();
  const updateSearchParams = useSearchParamsUpdater();
  const [createLead, setCreateLead] = useState<LeadListItem | null>(null);
  const [showProgressDisplay, setShowProgressDisplay] = useState(true);
  const monitoringProgress = useMonitoringProgress();
  const { cancelMonitoring } = useMonitoringActions();

  const { data: liveItems = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => getLeads(),
    initialData: items,
    staleTime: 30_000,
  });

  const activeTab = normalizeLeadTab(searchParams.get("tab"));
  const status = normalizeClassification(searchParams.get("status"));
  const companyId = normalizeCompanyId(searchParams.get("companyId"));

  // Search filters live while typing; the URL follows (debounced) so a reload
  // or shared link keeps the query.
  const [query, setQuery] = useState(() => (searchParams.get("q") ?? "").trim());
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("pt-BR");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const current = new URLSearchParams(window.location.search).get("q") ?? "";
      const next = query.trim();

      if (current === next) {
        return;
      }

      updateSearchParams((params) => {
        if (next) params.set("q", next);
        else params.delete("q");
      }, "replace");
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query, updateSearchParams]);

  const companyOptions = useMemo(
    () =>
      [...companies].sort((left, right) =>
        left.name.localeCompare(right.name, "pt-BR"),
      ),
    [companies],
  );

  const pendingItems = liveItems.filter(
    (item) => item.promotedToApplicationId === null,
  );
  const triageCount = pendingItems.filter((item) => item.userDecision === "none").length;
  const approvedCount = pendingItems.filter(
    (item) => item.userDecision === "approved",
  ).length;

  const tabItems = pendingItems.filter((item) =>
    activeTab === "triage"
      ? item.userDecision === "none"
      : item.userDecision === "approved",
  );

  // Counts on the classification chips reflect every other active filter.
  const facetItems = tabItems.filter((item) => {
    if (companyId !== null && item.companyId !== companyId) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      item.title,
      item.companyName,
      item.classificationReason,
      item.description,
      item.locationText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedQuery);
  });

  const classificationCounts = {
    all: facetItems.length,
    interesting: facetItems.filter((item) => item.classificationStatus === "interesting").length,
    review: facetItems.filter((item) => item.classificationStatus === "review").length,
  };

  const filteredItems = status
    ? facetItems.filter((item) => item.classificationStatus === status)
    : facetItems;

  const hasActiveFilters = Boolean(query.trim()) || status !== null || companyId !== null;

  const selectedLeadId = parseSelectedLeadId(searchParams.get("leadId"));
  const selectedLead =
    selectedLeadId === null
      ? null
      : liveItems.find((item) => item.id === selectedLeadId) ?? null;

  function setTab(tab: LeadTab) {
    updateSearchParams((params) => {
      params.set("tab", tab);
      params.delete("leadId");
    }, "replace");
  }

  function setClassification(value: ClassificationFilter) {
    updateSearchParams((params) => {
      if (value) params.set("status", value);
      else params.delete("status");
    }, "replace");
  }

  function setCompany(value: number | null) {
    updateSearchParams((params) => {
      if (value === null) params.delete("companyId");
      else params.set("companyId", String(value));
    }, "replace");
  }

  function clearFilters() {
    setQuery("");
    updateSearchParams((params) => {
      params.delete("q");
      params.delete("status");
      params.delete("companyId");
      params.delete("leadId");
    }, "replace");
  }

  function openLead(leadId: number) {
    updateSearchParams((params) => {
      params.set("tab", activeTab);
      params.set("leadId", String(leadId));
    });
  }

  function closeLead() {
    updateSearchParams((params) => {
      params.delete("leadId");
    }, "replace");
  }

  function closeCreateModal(open: boolean) {
    if (!open) {
      setCreateLead(null);
    }
  }

  const createInitialValues = createLead
    ? buildInitialValues(createLead)
    : undefined;

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 sm:gap-8">
        <PageHeader
          title="Leads"
          description="Aprove, descarte e promova as vagas que o radar encontrou."
          actions={
            <MonitoringRunButton
              label="Rodar radar completo"
              shortLabel="Radar"
              pendingLabel="Rodando…"
              className="h-10 rounded-xl px-4 sm:h-11 sm:px-5"
              showCancel={false}
              useStream
            />
          }
        />

        {monitoringProgress && (monitoringProgress.isRunning || showProgressDisplay) && (
          <MonitoringProgressDisplay
            isRunning={monitoringProgress.isRunning}
            currentCompany={monitoringProgress.currentCompany}
            companyIndex={monitoringProgress.companyIndex}
            totalCompanies={monitoringProgress.totalCompanies}
            linksProcessed={monitoringProgress.linksProcessed}
            linksTotal={monitoringProgress.linksTotal}
            events={monitoringProgress.events}
            stats={monitoringProgress.stats}
            result={monitoringProgress.result}
            onCancel={cancelMonitoring}
            onDismiss={() => setShowProgressDisplay(false)}
          />
        )}

        {/* Phones read these counts from the queue and filter controls instead. */}
        <div className="hidden gap-3 md:grid md:grid-cols-4">
          <StatCard
            label="Na triagem"
            value={triageCount}
            icon={ScanSearch}
            className="border-sky-400/20 bg-sky-400/8"
          />
          <StatCard
            label="Aprovados"
            value={approvedCount}
            icon={BriefcaseBusiness}
            className="border-emerald-400/20 bg-emerald-400/8"
          />
          <StatCard
            label="Interessantes"
            value={classificationCounts.interesting}
            icon={Sparkles}
            className="border-violet-400/20 bg-violet-400/8"
          />
          <StatCard
            label="Para revisar"
            value={classificationCounts.review}
            icon={Radar}
            className="border-amber-400/20 bg-amber-400/8"
          />
        </div>

        <section aria-label="Filtros de leads" className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div
              role="group"
              aria-label="Fila"
              className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-card/60 p-1 lg:w-80 lg:shrink-0"
            >
              {(["triage", "approved"] as const).map((tab) => {
                const isActive = activeTab === tab;
                const count = tab === "triage" ? triageCount : approvedCount;

                return (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setTab(tab)}
                    className={cn(
                      "flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-10",
                      isActive
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground active:bg-foreground/5",
                    )}
                  >
                    {tabCopy[tab].label}
                    <span
                      className={cn(
                        "min-w-5 rounded-full px-1.5 text-xs leading-5 tabular-nums",
                        isActive ? "bg-brand/20 text-brand" : "bg-foreground/6",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <form
              role="search"
              className="relative flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                (document.activeElement as HTMLElement | null)?.blur();
              }}
            >
              <label htmlFor="lead-search" className="sr-only">
                Buscar leads
              </label>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="lead-search"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por título, empresa, local…"
                className="h-11 w-full rounded-xl border border-input bg-input/30 pr-10 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground active:bg-foreground/5"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </form>
          </div>

          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {classificationOptions.map((option) => {
              const isActive = status === option.value;
              const count =
                option.value === null
                  ? classificationCounts.all
                  : classificationCounts[option.value];

              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setClassification(option.value)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "border-foreground/25 bg-foreground/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:text-foreground active:bg-foreground/5",
                  )}
                >
                  {option.label}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Styled pill over a transparent native select: system picker on
                phones, and the select stays 16px so iOS doesn't zoom. */}
            <div
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border pr-3 pl-3.5 text-sm font-medium transition-colors has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-ring",
                companyId !== null
                  ? "border-foreground/25 bg-foreground/10 text-foreground"
                  : "border-border/70 text-muted-foreground",
              )}
            >
              <span aria-hidden className="max-w-[11rem] truncate">
                {companyOptions.find((company) => company.id === companyId)?.name ??
                  "Todas as empresas"}
              </span>
              <ChevronDown aria-hidden className="size-3.5 shrink-0" />
              <select
                aria-label="Filtrar por empresa"
                value={companyId?.toString() ?? ""}
                onChange={(event) =>
                  setCompany(event.target.value ? Number(event.target.value) : null)
                }
                className="absolute inset-0 cursor-pointer appearance-none rounded-full text-base opacity-0 outline-none [&>option]:bg-popover [&>option]:text-popover-foreground"
              >
                <option value="">Todas as empresas</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex min-h-6 items-center justify-between gap-3 text-sm text-muted-foreground">
            <p aria-live="polite">
              {filteredItems.length === tabItems.length
                ? pluralizeLeads(filteredItems.length)
                : `${filteredItems.length} de ${pluralizeLeads(tabItems.length)}`}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="-my-2 rounded-md px-2 py-2 font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        </section>

        {items.length === 0 && liveItems.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed border-border/50 bg-card/40 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScanSearch />
              </EmptyMedia>
              <EmptyTitle>Nenhum lead salvo ainda</EmptyTitle>
              <EmptyDescription>
                O radar percorre os job boards das empresas monitoradas e traz as vagas para cá.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                href="/companies"
                className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
              >
                Ver empresas monitoradas
              </Link>
            </EmptyContent>
          </Empty>
        ) : filteredItems.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed border-border/50 bg-card/40 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScanSearch />
              </EmptyMedia>
              <EmptyTitle>{tabCopy[activeTab].emptyTitle}</EmptyTitle>
              <EmptyDescription>{tabCopy[activeTab].emptyDescription}</EmptyDescription>
            </EmptyHeader>
            {hasActiveFilters ? (
              <EmptyContent>
                <Button type="button" variant="outline" onClick={clearFilters} className="rounded-xl">
                  Limpar filtros
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <ul className="grid gap-3 sm:gap-4 xl:grid-cols-2">
            {filteredItems.map((lead) => (
              <li key={lead.id} className="min-w-0">
                <LeadCard
                  lead={lead}
                  tab={activeTab}
                  onOpen={() => openLead(lead.id)}
                  onCreateApplication={() => setCreateLead(lead)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <LeadDetailModal
        lead={selectedLead}
        onClose={closeLead}
        onCreateApplication={setCreateLead}
      />

      <ApplicationCreateModal
        key={createLead ? `lead-${createLead.id}` : "lead-create-empty"}
        companies={companies}
        open={createLead !== null}
        onOpenChange={closeCreateModal}
        initialValues={createInitialValues}
        submitAction={promoteApprovedLeadToApplication}
        submitLabel="Criar candidatura"
        pendingLabel="Criando…"
        title="Criar candidatura a partir do lead"
        descriptionValue="Revise os dados detectados pelo radar, ajuste o que faltar e crie a candidatura efetiva."
      />
    </>
  );
}

function LeadCard({
  lead,
  tab,
  onOpen,
  onCreateApplication,
}: {
  lead: LeadListItem;
  tab: LeadTab;
  onOpen: () => void;
  onCreateApplication: () => void;
}) {
  const { approve, discard, isApproving, isDiscarding } = useLeadDecisions(lead.id);
  const seniorityLabel = getSeniorityLabel(lead.seniority) ?? lead.seniority;
  const workModelLabel = getWorkModelLabel(lead.workModel) ?? lead.workModel;
  const isBusy = isApproving || isDiscarding;

  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-border/60 bg-card/85 transition-colors duration-150 hover:border-border has-[>button:active]:bg-card">
      {/* Stretched target: the whole card opens the detail sheet. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalhes: ${lead.title}`}
        className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-3 text-base leading-snug font-semibold text-balance text-foreground sm:text-lg">
              {lead.title}
            </h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {lead.companyName}
            </p>
          </div>
          <LeadStatusBadge status={lead.classificationStatus} />
        </div>

        {lead.classificationScore !== null || seniorityLabel || workModelLabel || lead.locationText ? (
          <div className="flex flex-wrap gap-1.5">
            {lead.classificationScore !== null ? (
              <Chip tone={scoreTone(lead.classificationScore)}>
                <Radar aria-hidden />
                Score {lead.classificationScore}
              </Chip>
            ) : null}
            {seniorityLabel ? <Chip>{seniorityLabel}</Chip> : null}
            {workModelLabel ? <Chip>{workModelLabel}</Chip> : null}
            {lead.locationText ? (
              <Chip className="max-w-[16rem]">
                <MapPin aria-hidden />
                <span className="truncate">{lead.locationText}</span>
              </Chip>
            ) : null}
          </div>
        ) : null}

        <p className="line-clamp-3 text-sm leading-6 text-pretty text-muted-foreground sm:line-clamp-none">
          {lead.classificationReason || "Sem justificativa resumida."}
        </p>

        {lead.description ? (
          <JobMarkdown
            content={lead.description}
            className="hidden max-h-40 overflow-hidden rounded-xl border border-border/50 bg-muted/15 p-4 [mask-image:linear-gradient(to_bottom,black_72%,transparent)] sm:block"
          />
        ) : null}

        <p className="mt-auto text-xs text-muted-foreground">
          {[
            getSourceNameLabel(lead.sourceName) ?? "Outra origem",
            lead.salaryText,
            `atualizado em ${formatDate(lead.updatedAt)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="relative z-10 flex items-center gap-2 border-t border-border/50 px-4 py-3 sm:px-5">
        <a
          href={lead.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir vaga original"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-lg" }),
            "shrink-0 rounded-xl sm:w-auto sm:px-3",
          )}
        >
          <ExternalLink />
          <span className="hidden sm:inline">Abrir vaga</span>
        </a>

        {tab === "triage" ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isBusy}
              onClick={discard}
              className="flex-1 rounded-xl sm:flex-none"
            >
              {isDiscarding ? "Descartando…" : "Descartar"}
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={isBusy}
              onClick={approve}
              className="flex-1 rounded-xl sm:flex-none"
            >
              <BriefcaseBusiness data-icon="inline-start" />
              {isApproving ? "Aprovando…" : "Aprovar"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onCreateApplication}
            className="flex-1 rounded-xl sm:flex-none"
          >
            <BriefcaseBusiness data-icon="inline-start" />
            Criar candidatura
          </Button>
        )}
      </div>
    </article>
  );
}

function normalizeLeadTab(value: string | null): LeadTab {
  return value === "approved" ? "approved" : "triage";
}

function normalizeClassification(value: string | null): ClassificationFilter {
  return value === "interesting" || value === "review" ? value : null;
}

function normalizeCompanyId(value: string | null) {
  return value && Number.isInteger(Number(value)) ? Number(value) : null;
}

function parseSelectedLeadId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function pluralizeLeads(count: number) {
  return count === 1 ? "1 lead" : `${count} leads`;
}

function buildInitialValues(lead: LeadListItem): ApplicationCreateInitialValues {
  return {
    leadId: lead.id,
    title: lead.title,
    companyId: String(lead.companyId),
    description: lead.description || "",
    sourceUrl: lead.sourceUrl,
    sourceName: lead.sourceName,
    workModel: lead.workModel || "",
    seniority: lead.seniority || "",
    status: "applied",
    notes: buildPromotionNote(lead),
  };
}

function buildPromotionNote(lead: LeadListItem) {
  const reason = lead.classificationReason?.trim();

  if (!reason) {
    return "Promovida a partir do radar manual de vagas.";
  }

  return `Promovida a partir do radar manual de vagas. Motivo: ${reason}`;
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
  value: number;
}) {
  return (
    <div className={cn("rounded-2xl border p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <Icon className="size-3.5 shrink-0 text-foreground/70" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function formatDate(date: Date | string | null) {
  if (!date) {
    return "sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
