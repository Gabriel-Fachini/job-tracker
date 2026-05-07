"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { startTransition, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  ExternalLink,
  Globe,
  MapPin,
  Radar,
  ScanSearch,
  Search,
  Sparkles,
} from "lucide-react";

import {
  ApplicationCreateModal,
  type ApplicationCreateInitialValues,
} from "@/components/applications/application-create-modal";
import { JobMarkdown } from "@/components/applications/job-markdown";
import { FormSubmitButton } from "@/components/companies/form-submit-button";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import type { LeadListItem, LeadTab } from "@/components/leads/types";
import { MonitoringRunButton, type MonitoringProgress } from "@/components/leads/monitoring-run-button";
import { MonitoringProgressDisplay } from "@/components/leads/monitoring-progress-display";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSourceNameLabel } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import {
  approveLead,
  discardLead,
  promoteApprovedLeadToApplication,
} from "@/server/actions/job-monitoring";

type LeadsClientProps = {
  companies: Array<{
    id: number;
    name: string;
  }>;
  items: LeadListItem[];
};

type LeadFilters = {
  q: string;
  rawQ: string;
  status: string | null;
  companyId: number | null;
};

const tabCopy: Record<
  LeadTab,
  {
    label: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
  }
> = {
  triage: {
    label: "Triagem",
    description: "Leads sem decisão manual aguardando aprovação ou descarte.",
    emptyTitle: "Nenhum lead pendente na triagem",
    emptyDescription:
      "Rode o radar para descobrir novas vagas ou ajuste os filtros ativos.",
  },
  approved: {
    label: "Aprovados",
    description: "Leads aprovados manualmente e prontos para virar candidatura.",
    emptyTitle: "Nenhum lead aprovado ainda",
    emptyDescription:
      "Aprove os melhores leads na triagem para separá-los nesta fila.",
  },
};

export function LeadsClient({ companies, items }: LeadsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createLead, setCreateLead] = useState<LeadListItem | null>(null);
  const [monitoringProgress, setMonitoringProgress] = useState<MonitoringProgress | null>(
    null
  );
  const [liveItems, setLiveItems] = useState<LeadListItem[]>(items);

  const activeTab = normalizeLeadTab(searchParams.get("tab"));
  const filters = normalizeLeadFilters({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
  });

  const companyOptions = useMemo(
    () =>
      companies
        .map((company) => ({ ...company }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [companies],
  );

  const tabItems = liveItems.filter((item) => {
    if (item.promotedToApplicationId !== null) {
      return false;
    }

    if (activeTab === "triage") {
      return item.userDecision === "none";
    }

    return item.userDecision === "approved";
  });

  const filteredItems = tabItems.filter((item) => {
    if (filters.status && item.classificationStatus !== filters.status) {
      return false;
    }

    if (filters.companyId !== null && item.companyId !== filters.companyId) {
      return false;
    }

    if (!filters.q) {
      return true;
    }

    const haystack = [
      item.title,
      item.companyName,
      item.classificationReason,
      item.description,
      item.locationText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return haystack.includes(filters.q);
  });

  const triageCount = liveItems.filter(
    (item) => item.userDecision === "none" && item.promotedToApplicationId === null,
  ).length;
  const approvedCount = liveItems.filter(
    (item) => item.userDecision === "approved" && item.promotedToApplicationId === null,
  ).length;
  const reviewCount = filteredItems.filter(
    (item) => item.classificationStatus === "review",
  ).length;
  const interestingCount = filteredItems.filter(
    (item) => item.classificationStatus === "interesting",
  ).length;
  const hasActiveFilters =
    Boolean(filters.q) || Boolean(filters.status) || filters.companyId !== null;

  const selectedLeadId = parseSelectedLeadId(searchParams.get("leadId"));
  const selectedLead =
    selectedLeadId === null
      ? null
      : filteredItems.find((item) => item.id === selectedLeadId) ?? null;

  function buildQuery(mutator: (params: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    const nextUrl = nextParams.size ? `${pathname}?${nextParams.toString()}` : pathname;
    router.push(nextUrl, { scroll: false });
  }

  function setTab(tab: LeadTab) {
    buildQuery((params) => {
      params.set("tab", tab);
      params.delete("leadId");
    });
  }

  function openLead(leadId: number) {
    buildQuery((params) => {
      params.set("tab", activeTab);
      params.set("leadId", String(leadId));
    });
  }

  function closeLead() {
    buildQuery((params) => {
      params.delete("leadId");
    });
  }

  function openCreateModal(lead: LeadListItem) {
    setCreateLead(lead);
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
      <div className="flex flex-1 flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Leads monitorados
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Aprove, descarte e promova oportunidades descobertas automaticamente.
            </p>
          </div>

          <MonitoringRunButton
            label="Rodar radar completo"
            pendingLabel="Rodando radar..."
            className="h-11 rounded-xl bg-amber-300 px-5 text-zinc-950 hover:bg-amber-200"
            useStream
            onProgressChange={setMonitoringProgress}
            onLeadAppended={(lead) => {
              const normalizedLead = {
                ...lead,
                discoveredAt: new Date(lead.discoveredAt),
                updatedAt: new Date(lead.updatedAt),
              };
              setLiveItems((prev) =>
                prev.some((i) => i.id === normalizedLead.id)
                  ? prev.map((i) => (i.id === normalizedLead.id ? normalizedLead : i))
                  : [normalizedLead, ...prev]
              );
            }}
            onComplete={() => startTransition(() => router.refresh())}
          />
        </div>

        {monitoringProgress && (
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
            onCancel={() => {
              if (monitoringProgress.eventSource) {
                monitoringProgress.eventSource.close();
                setMonitoringProgress(null);
              }
            }}
            onDismiss={() => setMonitoringProgress(null)}
          />
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Na triagem"
            value={String(triageCount)}
            icon={ScanSearch}
            className="border-sky-400/20 bg-sky-400/8"
          />
          <StatCard
            label="Aprovados"
            value={String(approvedCount)}
            icon={BriefcaseBusiness}
            className="border-emerald-400/20 bg-emerald-400/8"
          />
          <StatCard
            label="Interessantes"
            value={String(interestingCount)}
            icon={Sparkles}
            className="border-violet-400/20 bg-violet-400/8"
          />
          <StatCard
            label="Para revisar"
            value={String(reviewCount)}
            icon={Radar}
            className="border-amber-400/20 bg-amber-400/8"
          />
        </div>

        <Card className="border-border/60 bg-card/85">
          <CardContent className="flex flex-col gap-6 pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
                  Filas de triagem
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["triage", "approved"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTab(tab)}
                      className={cn(
                        buttonVariants({ variant: activeTab === tab ? "default" : "outline" }),
                        "rounded-xl",
                        activeTab === tab && "bg-primary text-primary-foreground",
                      )}
                    >
                      {tabCopy[tab].label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{tabCopy[activeTab].description}</p>
              </div>
            </div>

            <form className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_auto]">
              <input type="hidden" name="tab" value={activeTab} />

              <div className="space-y-2">
                <Label htmlFor="lead-search">Buscar</Label>
                <Input
                  id="lead-search"
                  name="q"
                  defaultValue={filters.rawQ}
                  placeholder="Título, empresa, motivo, local..."
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-status">Classificação</Label>
                <select
                  id="lead-status"
                  name="status"
                  defaultValue={filters.status ?? ""}
                  className="h-10 w-full rounded-xl border border-input bg-input/30 px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Todas</option>
                  <option value="interesting">Interessante</option>
                  <option value="review">Revisar</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-company">Empresa</Label>
                <select
                  id="lead-company"
                  name="companyId"
                  defaultValue={filters.companyId?.toString() ?? ""}
                  className="h-10 w-full rounded-xl border border-input bg-input/30 px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Todas</option>
                  {companyOptions.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className={cn(buttonVariants(), "h-10 rounded-xl px-4")}
                >
                  <Search data-icon="inline-start" className="size-4" />
                  Filtrar
                </button>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      buildQuery((params) => {
                        params.set("tab", activeTab);
                        params.delete("q");
                        params.delete("status");
                        params.delete("companyId");
                        params.delete("leadId");
                      });
                    }}
                    className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-xl px-4")}
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </form>

            <p className="text-sm text-muted-foreground">
              Mostrando {filteredItems.length} de {tabItems.length} leads na aba atual.
            </p>
          </CardContent>
        </Card>

        {items.length === 0 ? (
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
                Ir para empresas
              </Link>
            </EmptyContent>
          </Empty>
        ) : filteredItems.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed border-border/50 bg-card/40 py-20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScanSearch />
              </EmptyMedia>
              <EmptyTitle>{tabCopy[activeTab].emptyTitle}</EmptyTitle>
              <EmptyDescription>{tabCopy[activeTab].emptyDescription}</EmptyDescription>
            </EmptyHeader>
            {hasActiveFilters ? (
              <EmptyContent>
                <button
                  type="button"
                  onClick={() => {
                    buildQuery((params) => {
                      params.set("tab", activeTab);
                      params.delete("q");
                      params.delete("status");
                      params.delete("companyId");
                      params.delete("leadId");
                    });
                  }}
                  className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
                >
                  Limpar filtros
                </button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredItems.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                tab={activeTab}
                onOpen={() => openLead(lead.id)}
                onCreateApplication={() => openCreateModal(lead)}
                onDiscard={() => setLiveItems((prev) => prev.filter((i) => i.id !== lead.id))}
              />
            ))}
          </div>
        )}
      </div>

      <LeadDetailModal
        lead={selectedLead}
        tab={activeTab}
        onClose={closeLead}
        onCreateApplication={openCreateModal}
      />

      <ApplicationCreateModal
        key={createLead ? `lead-${createLead.id}` : "lead-create-empty"}
        companies={companies}
        open={createLead !== null}
        onOpenChange={closeCreateModal}
        initialValues={createInitialValues}
        submitAction={promoteApprovedLeadToApplication}
        submitLabel="Criar candidatura"
        pendingLabel="Criando..."
        title="Criar candidatura a partir do lead"
        description="Revise os dados detectados pelo radar, ajuste o que faltar e crie a candidatura efetiva."
      />
    </>
  );
}

function LeadCard({
  lead,
  tab,
  onOpen,
  onCreateApplication,
  onDiscard,
}: {
  lead: LeadListItem;
  tab: LeadTab;
  onOpen: () => void;
  onCreateApplication: () => void;
  onDiscard?: () => void;
}) {
  const [isDiscarding, startDiscardTransition] = useTransition();
  const approveAction = approveLead.bind(null, lead.id);
  const discardAction = discardLead.bind(null, lead.id);

  function stopPropagation(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="cursor-pointer border-border/60 bg-card/85 shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition-colors hover:border-border"
    >
      <CardHeader className="gap-4 border-b border-border/40 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl leading-7 text-balance">{lead.title}</CardTitle>
            <CardDescription className="mt-1 text-sm leading-6 text-muted-foreground">
              {lead.companyName}
            </CardDescription>
          </div>
          <LeadStatusBadge status={lead.classificationStatus} />
        </div>

        <div className="flex flex-wrap gap-2">
          {lead.classificationScore !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                lead.classificationScore >= 80
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : lead.classificationScore >= 50
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border-muted-foreground/30 bg-muted text-muted-foreground"
              )}
            >
              <Radar className="size-3" />
              Score {lead.classificationScore}
            </span>
          )}
          {lead.seniority && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700">
              <Sparkles className="size-3" />
              {formatSeniority(lead.seniority)}
            </span>
          )}
          {lead.workModel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-700">
              <Globe className="size-3" />
              {formatWorkModel(lead.workModel)}
            </span>
          )}
          {lead.locationText && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700">
              <MapPin className="size-3" />
              {lead.locationText}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-5">
        <p className="text-sm leading-6 text-muted-foreground">
          {lead.classificationReason || "Sem justificativa resumida."}
        </p>

        {lead.description ? (
          <JobMarkdown
            content={lead.description}
            className="max-h-40 overflow-hidden rounded-xl border border-border/50 bg-muted/15 p-4 [mask-image:linear-gradient(to_bottom,black_72%,transparent)]"
          />
        ) : null}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Fonte: {getSourceNameLabel(lead.sourceName) ?? "Outra origem"}</span>
          {lead.salaryText ? <span>Faixa: {lead.salaryText}</span> : null}
          <span>Atualizada em {formatDate(lead.updatedAt)}</span>
        </div>

        <div className="flex flex-wrap gap-3" onClick={stopPropagation}>
          <a
            href={lead.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
          >
            <ExternalLink data-icon="inline-start" />
            Abrir vaga
          </a>

          {tab === "triage" ? (
            <>
              <form action={approveAction}>
                <FormSubmitButton pendingLabel="Aprovando..." className="rounded-xl">
                  <BriefcaseBusiness data-icon="inline-start" />
                  Aprovar lead
                </FormSubmitButton>
              </form>

              <button
                type="button"
                disabled={isDiscarding}
                onClick={(e) => {
                  e.stopPropagation();
                  startDiscardTransition(async () => {
                    await discardAction();
                    onDiscard?.();
                  });
                }}
                className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
              >
                {isDiscarding ? "Descartando..." : "Descartar"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCreateApplication}
              className={cn(buttonVariants(), "rounded-xl")}
            >
              <BriefcaseBusiness data-icon="inline-start" />
              Criar candidatura
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function normalizeLeadTab(value: string | null): LeadTab {
  return value === "approved" ? "approved" : "triage";
}

function parseSelectedLeadId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeLeadFilters(query: {
  q?: string;
  status?: string;
  companyId?: string;
}): LeadFilters {
  const rawQ = (query.q ?? "").trim();
  const q = rawQ ? rawQ.toLocaleLowerCase("pt-BR") : "";
  const status =
    query.status === "interesting" || query.status === "review"
      ? query.status
      : null;
  const companyId =
    query.companyId && Number.isInteger(Number(query.companyId))
      ? Number(query.companyId)
      : null;

  return {
    rawQ,
    q,
    status,
    companyId,
  };
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
      <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
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
