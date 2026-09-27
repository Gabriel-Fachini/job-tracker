"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, ScanSearch, Search, X } from "lucide-react";

import {
  ApplicationCreateModal,
  type ApplicationCreateInitialValues,
} from "@/components/applications/application-create-modal";
import { useLeadDecisions } from "@/components/leads/lead-decisions";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { ScoreMeter } from "@/components/leads/score-meter";
import type { LeadListItem, LeadTab } from "@/components/leads/types";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { MonitoringProgressDisplay } from "@/components/leads/monitoring-progress-display";
import { useMonitoringActions, useMonitoringProgress } from "@/components/leads/monitoring-progress-context";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { MetaLine } from "@/components/ui/meta-line";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { TabBar, TabBarItem } from "@/components/ui/tab-bar";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";
import { getSeniorityLabel, getWorkModelLabel } from "@/lib/jobs";
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
      "Rode o radar para descobrir novas vagas nas empresas monitoradas.",
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

  // Counts on the classification toggles reflect every other active filter.
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

  const selectedCompanyName =
    companyOptions.find((company) => company.id === companyId)?.name ?? null;

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 sm:gap-6">
        <PageHeader
          title="Leads"
          description={
            <>
              <span className="font-data text-foreground">{triageCount}</span> na triagem
              <span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>
              <span className="font-data text-foreground">{approvedCount}</span>{" "}
              {approvedCount === 1 ? "aprovado" : "aprovados"}
            </>
          }
          actions={
            <MonitoringRunButton
              label="Rodar radar"
              shortLabel="Radar"
              pendingLabel="Rodando…"
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
            onCancel={monitoringProgress.eventSource ? cancelMonitoring : undefined}
            onDismiss={() => setShowProgressDisplay(false)}
          />
        )}

        <section aria-label="Filtros de leads" className="flex flex-col gap-2 md:flex-row md:items-center">
          <form
            role="search"
            className="relative md:max-w-sm md:flex-1"
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
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle-foreground"
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
              className="h-8 w-full rounded-lg border border-border bg-surface pr-9 pl-8 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-subtle-foreground hover:border-input focus-visible:border-ring focus-visible:bg-field focus-visible:ring-2 focus-visible:ring-ring/25 pointer-coarse:h-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-8"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </form>

          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:overflow-visible md:px-0">
            <SegmentedControl aria-label="Classificação">
              {classificationOptions.map((option) => (
                <SegmentedControlItem
                  key={option.label}
                  pressed={status === option.value}
                  count={
                    option.value === null
                      ? classificationCounts.all
                      : classificationCounts[option.value]
                  }
                  onClick={() => setClassification(option.value)}
                >
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>

            {/* Native select under a styled face: system picker on phones,
                and the select stays 16px there so iOS doesn't zoom. */}
            <div
              className={cn(
                "relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-field pr-2 pl-2.5 text-[13px] font-medium transition-[border-color,box-shadow] duration-150 has-[select:focus-visible]:border-ring has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-ring/25 pointer-coarse:h-10",
                companyId !== null
                  ? "border-border-strong text-foreground"
                  : "border-input text-muted-foreground",
              )}
            >
              <span aria-hidden className="max-w-[11rem] truncate">
                {selectedCompanyName ?? "Todas as empresas"}
              </span>
              <ChevronDown aria-hidden className="size-3.5 shrink-0 text-subtle-foreground" />
              <select
                aria-label="Filtrar por empresa"
                value={companyId?.toString() ?? ""}
                onChange={(event) =>
                  setCompany(event.target.value ? Number(event.target.value) : null)
                }
                className="absolute inset-0 cursor-pointer appearance-none rounded-lg text-base opacity-0 outline-none [&>option]:bg-popover [&>option]:text-popover-foreground"
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
        </section>

        <section
          aria-label="Fila de leads"
          className="-mx-4 border-y border-border sm:mx-0 sm:rounded-xl sm:border-x"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border pr-3 pl-1 sm:pr-4">
            <TabBar aria-label="Fila" className="border-b-0">
              {(["triage", "approved"] as const).map((tab) => (
                <TabBarItem
                  key={tab}
                  selected={activeTab === tab}
                  count={tab === "triage" ? triageCount : approvedCount}
                  onClick={() => setTab(tab)}
                >
                  {tabCopy[tab].label}
                </TabBarItem>
              ))}
            </TabBar>

            <div className="flex min-w-0 items-center gap-3 text-xs text-subtle-foreground">
              <p aria-live="polite" className="font-data whitespace-nowrap">
                {filteredItems.length === tabItems.length
                  ? pluralizeLeads(filteredItems.length)
                  : `${filteredItems.length}/${tabItems.length}`}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="-my-1 rounded-md px-1.5 py-1 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>

          {items.length === 0 && liveItems.length === 0 ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScanSearch />
                </EmptyMedia>
                <EmptyTitle>Nenhum lead salvo ainda</EmptyTitle>
                <EmptyDescription>
                  O radar percorre os job boards das suas empresas, exceto as descartadas e as da blacklist, e traz as vagas para cá.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href="/companies" className={buttonVariants({ variant: "outline" })}>
                  Ver empresas monitoradas
                </Link>
              </EmptyContent>
            </Empty>
          ) : filteredItems.length === 0 ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScanSearch />
                </EmptyMedia>
                <EmptyTitle>
                  {hasActiveFilters ? "Nenhum lead com esses filtros" : tabCopy[activeTab].emptyTitle}
                </EmptyTitle>
                <EmptyDescription>
                  {hasActiveFilters
                    ? "Ajuste a busca ou limpe os filtros para ver a fila completa."
                    : tabCopy[activeTab].emptyDescription}
                </EmptyDescription>
              </EmptyHeader>
              {hasActiveFilters ? (
                <EmptyContent>
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  tab={activeTab}
                  onOpen={() => openLead(lead.id)}
                  onCreateApplication={() => setCreateLead(lead)}
                />
              ))}
            </ul>
          )}
        </section>
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

function LeadRow({
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
  const isBusy = isApproving || isDiscarding;
  const meta = [
    getSeniorityLabel(lead.seniority) ?? lead.seniority,
    getWorkModelLabel(lead.workModel) ?? lead.workModel,
    lead.locationText,
    lead.salaryText,
  ].filter(Boolean);

  return (
    <li className="group relative transition-colors duration-150 hover:bg-surface has-[>button:active]:bg-surface">
      {/* Stretched target: the whole row opens the detail sheet. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalhes: ${lead.title}`}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />

      <div className="flex gap-3.5 px-4 py-4 sm:gap-4 sm:px-5">
        <div className="w-7 shrink-0 pt-0.5">
          {lead.classificationScore !== null ? (
            <ScoreMeter score={lead.classificationScore} />
          ) : (
            <span className="font-data text-[15px] leading-none text-subtle-foreground">
              <span className="sr-only">Sem score</span>
              <span aria-hidden>–</span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-[15px] leading-snug font-medium text-balance text-foreground">
              {lead.title}
            </h3>
            <div className="flex shrink-0 items-center gap-3 pt-0.5">
              <LeadStatusBadge status={lead.classificationStatus} />
              <time
                dateTime={toIsoString(lead.updatedAt)}
                className="hidden font-data text-xs text-subtle-foreground sm:inline"
              >
                {formatShortDate(lead.updatedAt)}
              </time>
            </div>
          </div>

          <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1">
              <MetaLine
                items={[
                  <span key="company" className="text-foreground">{lead.companyName}</span>,
                  ...meta,
                ]}
              />
              <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-pretty text-muted-foreground">
                {lead.classificationReason || "Sem justificativa resumida."}
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-1.5">
              <a
                href={lead.sourceUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir vaga original"
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <ExternalLink />
              </a>

              {tab === "triage" ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={discard}
                    className="flex-1 sm:flex-none"
                  >
                    {isDiscarding ? "Descartando…" : "Descartar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={approve}
                    className="flex-1 sm:flex-none"
                  >
                    {isApproving ? "Aprovando…" : "Aprovar"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCreateApplication}
                  className="flex-1 sm:flex-none"
                >
                  Criar candidatura
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
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

function toIsoString(date: Date | string) {
  return new Date(date).toISOString();
}

function formatShortDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(date));
}
