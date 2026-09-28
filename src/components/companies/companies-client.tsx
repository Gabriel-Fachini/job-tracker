"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  animated,
  config,
  useTransition as useSpringTransition,
  type SpringValues,
} from "@react-spring/web";
import { Building2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import type { CompanyFormValues } from "@/components/companies/company-form";
import { CompanyLogo } from "@/components/companies/company-logo";
import { CompanyRowActions } from "@/components/companies/company-row-actions";
import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";
import {
  companyStatusOptions,
  getCompanySizeLabel,
  isCompanyStatus,
  isMonitorableJobsBoardUrl,
  radarSkippedCompanyStatuses,
  type CompanyStatus,
} from "@/lib/companies";
import type { CompanyLogoView } from "@/lib/company-logos";
import { cn } from "@/lib/utils";
import {
  bulkDeleteCompanies,
  bulkSetCompanyRadarEnabled,
  setCompanyRadarEnabled,
} from "@/server/actions/companies";
import { runAllCompaniesMonitoring } from "@/server/actions/job-monitoring";

export type CompanyListItem = {
  id: number;
  name: string;
  status: string;
  sector: string | null;
  size: string | null;
  website: string | null;
  updatedAt: Date | null;
  radarEnabled: boolean;
  applicationsCount: number;
  jobsCount: number;
  leadsCount: number;
  logo: CompanyLogoView;
  formValues: CompanyFormValues;
};

type StatusFilter = CompanyStatus | null;

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: null, label: "Todas" },
  ...companyStatusOptions.map((option) => ({ value: option.value, label: option.label })),
];

export function CompaniesClient({ rows }: { rows: CompanyListItem[] }) {
  const searchParams = useSearchParams();
  const updateSearchParams = useSearchParamsUpdater();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pendingRadarIds, setPendingRadarIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkPending, startBulk] = useTransition();

  const status = normalizeStatus(searchParams.get("status"));

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

  // Drop ids a mutation already removed from `rows`, without writing state
  // back during render.
  const validSelectedIds = useMemo(
    () => new Set([...selectedIds].filter((id) => rows.some((row) => row.id === id))),
    [selectedIds, rows],
  );

  const totalCompanies = rows.length;
  const totalLinkedApplications = rows.reduce(
    (accumulator, row) => accumulator + row.applicationsCount,
    0,
  );
  const radarCount = rows.filter(
    (row) =>
      row.radarEnabled &&
      isMonitorableJobsBoardUrl(row.formValues.jobsBoardUrl) &&
      isCompanyStatus(row.status) &&
      !radarSkippedCompanyStatuses.includes(row.status),
  ).length;

  const searchedRows = normalizedQuery
    ? rows.filter((row) =>
        [row.name, row.sector, row.website]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedQuery),
      )
    : rows;

  const statusCounts: Record<"all" | CompanyStatus, number> = {
    all: searchedRows.length,
    monitoring: 0,
    in_process: 0,
    discarded: 0,
    blacklist: 0,
  };
  for (const row of searchedRows) {
    if (isCompanyStatus(row.status)) {
      statusCounts[row.status] += 1;
    }
  }

  const filteredRows = status ? searchedRows.filter((row) => row.status === status) : searchedRows;
  const hasActiveFilters = Boolean(query.trim()) || status !== null;

  const filteredIds = filteredRows.map((row) => row.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => validSelectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => validSelectedIds.has(id));

  // The bulk toolbar pops in instead of instantly shifting the layout when a
  // row gets checked — the moment mobile users most notice a jump.
  const bulkActionsTransition = useSpringTransition(validSelectedIds.size > 0, {
    from: { opacity: 0, transform: "scale(0.96) translateY(-2px)" },
    enter: { opacity: 1, transform: "scale(1) translateY(0px)" },
    leave: { opacity: 0, transform: "scale(0.96) translateY(-2px)" },
    config: config.stiff,
  });

  // Rows fade and settle in on mount and on every filter/search change;
  // removed rows fade out instead of vanishing.
  const rowTransitions = useSpringTransition(filteredRows, {
    keys: (row) => row.id,
    from: { opacity: 0, transform: "translateY(6px)" },
    enter: { opacity: 1, transform: "translateY(0px)" },
    leave: { opacity: 0, transform: "translateY(-6px)" },
    config: config.gentle,
    trail: 20,
  });

  function setStatus(value: StatusFilter) {
    updateSearchParams((params) => {
      if (value) params.set("status", value);
      else params.delete("status");
    }, "replace");
  }

  function clearFilters() {
    setQuery("");
    updateSearchParams((params) => {
      params.delete("q");
      params.delete("status");
    }, "replace");
  }

  function toggleSelected(id: number) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((previous) => {
      if (allFilteredSelected) {
        const next = new Set(previous);
        for (const id of filteredIds) next.delete(id);
        return next;
      }

      return new Set([...previous, ...filteredIds]);
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleRadarToggle(row: CompanyListItem, next: boolean) {
    setPendingRadarIds((previous) => new Set(previous).add(row.id));

    const result = await setCompanyRadarEnabled(row.id, next);

    setPendingRadarIds((previous) => {
      const copy = new Set(previous);
      copy.delete(row.id);
      return copy;
    });

    if (!result.ok) {
      toast.error("Não foi possível atualizar o radar desta empresa.");
      return;
    }

    toast.success(next ? "Incluída no próximo scan" : "Fora do próximo scan", {
      description: row.name,
    });
  }

  function handleBulkRadar(enabled: boolean) {
    const ids = [...validSelectedIds];

    startBulk(async () => {
      const result = await bulkSetCompanyRadarEnabled(ids, enabled);
      clearSelection();
      toast.success(
        enabled
          ? `${pluralizeCompanies(result.updated)} incluída(s) no próximo scan`
          : `${pluralizeCompanies(result.updated)} fora do próximo scan`,
      );
    });
  }

  function handleBulkDelete() {
    const ids = [...validSelectedIds];

    startBulk(async () => {
      const result = await bulkDeleteCompanies(ids);
      setBulkDeleteOpen(false);
      clearSelection();

      if (result.deleted > 0) {
        toast.success(`${pluralizeCompanies(result.deleted)} excluída(s)`);
      }

      if (result.blocked > 0) {
        toast.error(
          `${pluralizeCompanies(result.blocked)} não pôde(puderam) ser excluída(s): há vagas vinculadas.`,
        );
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Empresas"
        description={
          <>
            <span className="font-data text-foreground">{totalCompanies}</span>{" "}
            {totalCompanies === 1 ? "empresa" : "empresas"}
            <span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>
            <span className="font-data text-foreground">{totalLinkedApplications}</span>{" "}
            {totalLinkedApplications === 1 ? "candidatura" : "candidaturas"}
            <span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>
            <span className="font-data text-foreground">{radarCount}</span> no radar
          </>
        }
        actions={
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
        }
      />

      <section aria-label="Filtros de empresas" className="flex flex-col gap-2 md:flex-row md:items-center">
        <form
          role="search"
          className="relative md:max-w-sm md:flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        >
          <label htmlFor="company-search" className="sr-only">
            Buscar empresas
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle-foreground"
          />
          <input
            id="company-search"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, setor, site…"
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
          <SegmentedControl aria-label="Status da empresa">
            {statusFilterOptions.map((option) => (
              <SegmentedControlItem
                key={option.value ?? "all"}
                pressed={status === option.value}
                count={option.value === null ? statusCounts.all : statusCounts[option.value]}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
      </section>

      <section
        aria-label="Lista de empresas"
        className="-mx-4 overflow-hidden border-y border-border sm:mx-0 sm:rounded-xl sm:border-x"
      >
        {rows.length > 0 ? (
          <>
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 sm:px-5">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allFilteredSelected}
                  indeterminate={!allFilteredSelected && someFilteredSelected}
                  onCheckedChange={toggleSelectAllFiltered}
                  disabled={filteredRows.length === 0}
                  aria-label="Selecionar todas as empresas exibidas"
                />
                {validSelectedIds.size > 0 ? (
                  <span className="text-[13px] font-medium text-foreground">
                    <span className="font-data">{validSelectedIds.size}</span>{" "}
                    {validSelectedIds.size === 1 ? "selecionada" : "selecionadas"}
                  </span>
                ) : (
                  <>
                    <p aria-live="polite" className="font-data text-xs text-subtle-foreground whitespace-nowrap">
                      {filteredRows.length === rows.length
                        ? pluralizeCompanies(filteredRows.length)
                        : `${filteredRows.length}/${rows.length}`}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="-my-1 rounded-md px-1.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Limpar filtros
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              {bulkActionsTransition(
                (style, show) =>
                  show && (
                    <animated.div style={style} className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBulkPending}
                        onClick={() => handleBulkRadar(true)}
                      >
                        Incluir no radar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBulkPending}
                        onClick={() => handleBulkRadar(false)}
                      >
                        Remover do radar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isBulkPending}
                        onClick={() => setBulkDeleteOpen(true)}
                      >
                        Excluir
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
                        Cancelar
                      </Button>
                    </animated.div>
                  ),
              )}
            </div>

            {filteredRows.length > 0 ? (
              <div
                aria-hidden
                className="hidden border-b border-border py-2 text-xs font-medium text-subtle-foreground lg:flex lg:gap-4 lg:px-5"
              >
                <div className="w-4 shrink-0" />
                <div className="grid flex-1 grid-cols-[2.5rem_minmax(0,1fr)_7rem_5.5rem_2.75rem_auto] items-center gap-x-5">
                  <span className="col-start-2">Empresa</span>
                  <span className="col-start-3">Status</span>
                  <span className="col-start-4 text-right">Atualizada</span>
                  <span className="col-start-5 text-center">Radar</span>
                  <span className="col-start-6">Ações</span>
                </div>
              </div>
            ) : null}

            {filteredRows.length === 0 ? (
              <Empty className="py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Building2 />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma empresa com esses filtros</EmptyTitle>
                  <EmptyDescription>Ajuste a busca ou limpe os filtros para ver a lista completa.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {rowTransitions((style, row) => (
                  <CompanyRow
                    style={style}
                    item={row}
                    selected={validSelectedIds.has(row.id)}
                    onToggleSelect={() => toggleSelected(row.id)}
                    radarPending={pendingRadarIds.has(row.id)}
                    onToggleRadar={(next) => handleRadarToggle(row, next)}
                  />
                ))}
              </ul>
            )}
          </>
        ) : (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>Nenhuma empresa registrada</EmptyTitle>
              <EmptyDescription>
                Comece pelas empresas que você quer observar com calma, mesmo antes de existir uma vaga
                ativa.
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

      <Dialog open={bulkDeleteOpen} onOpenChange={(next) => !isBulkPending && setBulkDeleteOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Excluir {pluralizeCompanies(validSelectedIds.size)}?
            </DialogTitle>
            <DialogDescription className="text-pretty">
              Empresas sem vagas vinculadas saem da lista, junto com os leads do radar nelas. Empresas com
              vagas ou candidaturas ficam de fora e continuam na lista. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="max-sm:mx-0 max-sm:mb-0 max-sm:grid max-sm:grid-cols-2 max-sm:border-t-0 max-sm:p-0 max-sm:pt-2">
            <DialogClose render={<Button type="button" variant="ghost" disabled={isBulkPending} />}>
              Cancelar
            </DialogClose>
            <Button type="button" variant="destructive" disabled={isBulkPending} onClick={handleBulkDelete}>
              {isBulkPending ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyRow({
  item,
  selected,
  onToggleSelect,
  radarPending,
  onToggleRadar,
  style,
}: {
  item: CompanyListItem;
  selected: boolean;
  onToggleSelect: () => void;
  radarPending: boolean;
  onToggleRadar: (next: boolean) => void;
  style: SpringValues<{ opacity: number; transform: string }>;
}) {
  const sizeLabel = getCompanySizeLabel(item.size);
  const hasApplications = item.applicationsCount > 0;

  return (
    <animated.li
      style={style}
      className={cn(
        "group relative flex gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface has-[a[data-row-link]:active]:bg-surface sm:gap-4 sm:px-5",
        selected && "bg-surface",
      )}
    >
      <div className="relative z-10 pt-1.5 lg:self-center lg:pt-0">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`Selecionar ${item.name}`}
        />
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-x-3 lg:grid-cols-[2.5rem_minmax(0,1fr)_7rem_5.5rem_2.75rem_auto] lg:items-center lg:gap-x-5">
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
            columns so statuses, dates, the radar switch and actions line up
            down the list. */}
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
          <label
            title={item.radarEnabled ? "No próximo scan do radar" : "Fora do próximo scan do radar"}
            className="relative z-10 inline-flex shrink-0 items-center lg:col-start-5 lg:row-span-3 lg:row-start-1 lg:justify-self-center"
          >
            <span className="sr-only">Incluir {item.name} no próximo scan do radar</span>
            <Switch
              checked={item.radarEnabled}
              disabled={radarPending}
              onCheckedChange={onToggleRadar}
            />
          </label>
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
            className="-my-1 lg:col-start-6 lg:row-span-3 lg:row-start-1 lg:my-0"
          />
        </div>
      </div>
    </animated.li>
  );
}

function normalizeStatus(value: string | null): StatusFilter {
  return value && isCompanyStatus(value) ? value : null;
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

function pluralizeCompanies(count: number) {
  return count === 1 ? "1 empresa" : `${count} empresas`;
}
