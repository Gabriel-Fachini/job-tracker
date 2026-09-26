"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CalendarDays, Inbox, Plus } from "lucide-react";
import { toast } from "sonner";

import { ApplicationCreateModal } from "@/components/applications/application-create-modal";
import {
  ApplicationDetailModal,
  type ApplicationDetailData,
  type ApplicationStageData,
} from "@/components/applications/application-detail-modal";
import { ApplicationStatusSelect } from "@/components/applications/application-status-select";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";
import {
  applicationStatusLabelMap,
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/applications";
import {
  getSeniorityLabel,
  getSourceNameLabel,
  getWorkModelLabel,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";
import { updateApplicationStatus } from "@/server/actions/applications";

type ApplicationListItem = {
  id: number;
  status: ApplicationStatus;
  jobTitle: string;
  company: string | null;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  workModel: string | null;
  seniority: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  usedResumeStatus: string;
  usedResumePath: string | null;
  usedResumeOriginalFilename: string | null;
  generatedResumePath: string | null;
  notes: string | null;
  isReferral: boolean;
  stages: ApplicationStageData[];
};

type ApplicationsClientProps = {
  companies: Array<{
    id: number;
    name: string;
  }>;
  items: ApplicationListItem[];
  /** Server-rendered overview shown between the header and the list. */
  summary?: React.ReactNode;
};

type BoardState = Record<ApplicationStatus, ApplicationListItem[]>;

const STATUS_ORDER: ApplicationStatus[] = [
  "applied",
  "in_process",
  "offer",
  "approved",
  "rejected",
  "withdrawn",
];

function createBoard(items: ApplicationListItem[]): BoardState {
  const board: BoardState = {
    applied: [],
    in_process: [],
    offer: [],
    approved: [],
    rejected: [],
    withdrawn: [],
  };

  for (const item of items) {
    board[item.status].push(item);
  }

  return board;
}

function moveCard(
  board: BoardState,
  applicationId: number,
  targetStatus: ApplicationStatus,
): BoardState {
  let moved: ApplicationListItem | null = null;

  const nextBoard = Object.fromEntries(
    Object.entries(board).map(([status, items]) => {
      const typedStatus = status as ApplicationStatus;
      const nextItems = items.filter((item) => {
        if (item.id !== applicationId) return true;
        moved = { ...item, status: targetStatus };
        return false;
      });
      return [typedStatus, nextItems];
    }),
  ) as BoardState;

  if (!moved) return board;

  return {
    ...nextBoard,
    [targetStatus]: [moved, ...nextBoard[targetStatus]],
  };
}

function buildApplicationDetail(item: ApplicationListItem): ApplicationDetailData {
  return {
    id: item.id,
    status: item.status,
    jobTitle: item.jobTitle,
    company: item.company,
    description: item.description,
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
    workModel: item.workModel,
    seniority: item.seniority,
    appliedAt: item.appliedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    usedResumeStatus: item.usedResumeStatus,
    usedResumePath: item.usedResumePath,
    usedResumeOriginalFilename: item.usedResumeOriginalFilename,
    generatedResumePath: item.generatedResumePath,
    notes: item.notes,
    isReferral: item.isReferral,
    stages: item.stages,
  };
}

function findApplicationById(
  board: BoardState,
  applicationId: number,
): ApplicationListItem | null {
  for (const items of Object.values(board)) {
    const match = items.find((item) => item.id === applicationId);
    if (match) return match;
  }
  return null;
}

function parseSelectedApplicationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function formatCardDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ApplicationListRow({
  item,
  onOpenDetails,
  onStatusChange,
}: {
  item: ApplicationListItem;
  onOpenDetails: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
}) {
  const workModelLabel = getWorkModelLabel(item.workModel);
  const seniorityLabel = getSeniorityLabel(item.seniority);
  const sourceNameLabel = getSourceNameLabel(item.sourceName);
  const dateLabel = formatCardDate(item.appliedAt ?? item.createdAt);
  const hasChips = Boolean(workModelLabel || seniorityLabel || sourceNameLabel);

  return (
    <li className="group relative transition-colors duration-150 hover:bg-foreground/[0.04] has-[>button:active]:bg-foreground/[0.06]">
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={`Abrir candidatura: ${item.jobTitle}`}
        className="absolute inset-0 outline-none focus-visible:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />

      <div className="flex flex-col gap-2.5 px-4 py-3.5 md:flex-row md:items-center md:gap-4 md:px-5">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium text-foreground md:truncate">
            {item.jobTitle}
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{item.company ?? "Empresa não informada"}</span>
            <span aria-hidden className="md:hidden">·</span>
            <span className="shrink-0 md:hidden">{dateLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 md:shrink-0">
          {hasChips ? (
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 md:flex-none">
              {workModelLabel ? <Chip>{workModelLabel}</Chip> : null}
              {seniorityLabel ? <Chip>{seniorityLabel}</Chip> : null}
              {sourceNameLabel ? <Chip tone="info">{sourceNameLabel}</Chip> : null}
            </div>
          ) : (
            <div className="flex-1 md:hidden" />
          )}

          <span className="hidden shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground md:flex">
            <CalendarDays aria-hidden className="size-3 shrink-0" />
            {dateLabel}
          </span>

          <ApplicationStatusSelect
            value={item.status}
            onChange={onStatusChange}
            className="relative z-10"
          />
        </div>
      </div>
    </li>
  );
}

export function ApplicationsClient({ companies, items, summary }: ApplicationsClientProps) {
  const searchParams = useSearchParams();
  const updateSearchParams = useSearchParamsUpdater();
  const [createOpen, setCreateOpen] = useState(false);
  const [board, setBoard] = useState(() => createBoard(items));

  // Server refreshes (after saving a stage, notes...) hand us new items; adopt
  // them without remounting so an open detail sheet stays put.
  const [syncedItems, setSyncedItems] = useState(items);
  if (items !== syncedItems) {
    setSyncedItems(items);
    setBoard(createBoard(items));
  }

  const statusParam = searchParams.get("status");
  const activeTab: ApplicationStatus =
    statusParam && isApplicationStatus(statusParam)
      ? statusParam
      : (STATUS_ORDER.find((status) => board[status].length > 0) ?? "applied");

  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<ApplicationStatus, HTMLButtonElement | null>>>({});

  // Keep the active status visible in the scrollable tab row (e.g. a deep link
  // to "Desistiu"). Horizontal only, so the page itself never jumps.
  useEffect(() => {
    const list = tabListRef.current;
    const tab = tabRefs.current[activeTab];
    if (!list || !tab) return;

    const tabStart = tab.offsetLeft;
    const tabEnd = tabStart + tab.offsetWidth;
    if (tabStart < list.scrollLeft || tabEnd > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: tabStart - 16, behavior: "smooth" });
    }
  }, [activeTab]);

  function setActiveTab(status: ApplicationStatus) {
    updateSearchParams((params) => {
      params.set("status", status);
    }, "replace");
  }

  function setApplicationQuery(applicationId: number | null) {
    updateSearchParams(
      (params) => {
        if (applicationId === null) {
          params.delete("applicationId");
        } else {
          params.set("applicationId", String(applicationId));
        }
      },
      applicationId === null ? "replace" : "push",
    );
  }

  function handleStatusChange(applicationId: number, targetStatus: ApplicationStatus) {
    const current = findApplicationById(board, applicationId);
    if (!current || targetStatus === current.status) return;

    const snapshot = board;
    setBoard(moveCard(snapshot, applicationId, targetStatus));

    void updateApplicationStatus(applicationId, targetStatus).then((result) => {
      if (!result.success) {
        setBoard(snapshot);
        toast.error("Não foi possível atualizar o status. O estado foi revertido.");
        return;
      }

      toast.success(`Movida para ${applicationStatusLabelMap[targetStatus]}`);
    });
  }

  const selectedApplicationId = parseSelectedApplicationId(
    searchParams.get("applicationId"),
  );
  const selectedApplication =
    selectedApplicationId === null
      ? null
      : findApplicationById(board, selectedApplicationId);
  const detailApp = selectedApplication
    ? buildApplicationDetail(selectedApplication)
    : null;

  const totalCount = STATUS_ORDER.reduce((sum, status) => sum + board[status].length, 0);
  const activeItems = board[activeTab];

  return (
    <>
      <PageHeader
        title="Candidaturas"
        description={
          totalCount === 0
            ? "Nenhuma candidatura registrada ainda."
            : totalCount === 1
              ? "1 candidatura registrada."
              : `${totalCount} candidaturas registradas.`
        }
        actions={
          <Button
            variant="brand"
            size="lg"
            onClick={() => setCreateOpen(true)}
            className="h-10 rounded-xl px-4 sm:h-11 sm:px-5"
          >
            <Plus data-icon="inline-start" />
            <span className="sm:hidden">Nova</span>
            <span className="hidden sm:inline">Nova candidatura</span>
          </Button>
        }
      />

      {summary}

      {totalCount === 0 ? (
        <Empty className="rounded-3xl border border-dashed border-border/50 bg-card/40 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>Nenhuma candidatura registrada</EmptyTitle>
            <EmptyDescription className="max-w-xs">
              Registre a vaga, o status inicial e acompanhe cada etapa do processo seletivo aqui.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => setCreateOpen(true)}
            className="mt-1 h-10 rounded-xl px-5"
          >
            <Plus data-icon="inline-start" />
            Registrar primeira candidatura
          </Button>
        </Empty>
      ) : (
        <section
          aria-label="Candidaturas por status"
          className="-mx-4 border-y border-border/60 bg-card/50 sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border"
        >
          <div
            ref={tabListRef}
            role="tablist"
            aria-label="Status"
            className="relative flex snap-x overflow-x-auto border-b border-border/50 px-2 scrollbar-none sm:px-0"
          >
            {STATUS_ORDER.map((status) => {
              const count = board[status].length;
              const isActive = activeTab === status;

              return (
                <button
                  key={status}
                  ref={(node) => {
                    tabRefs.current[status] = node;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(status)}
                  className={cn(
                    "relative flex h-12 shrink-0 snap-start items-center gap-2 px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:bg-foreground/5 sm:px-4",
                    isActive
                      ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand"
                      : "text-muted-foreground hover:text-foreground/85",
                  )}
                >
                  {applicationStatusLabelMap[status]}
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-medium tabular-nums",
                      isActive ? "bg-brand/20 text-brand" : "bg-foreground/6 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            key={activeTab}
            role="tabpanel"
            aria-label={applicationStatusLabelMap[activeTab]}
            className="animate-in fade-in-0 duration-150"
          >
            {activeItems.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>Nada em {applicationStatusLabelMap[activeTab]}</EmptyTitle>
                  <EmptyDescription>
                    Mude o status de uma candidatura para ela aparecer nesta etapa.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-y divide-border/40">
                {activeItems.map((item) => (
                  <ApplicationListRow
                    key={item.id}
                    item={item}
                    onOpenDetails={() => setApplicationQuery(item.id)}
                    onStatusChange={(status) => handleStatusChange(item.id, status)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <ApplicationCreateModal
        companies={companies}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <ApplicationDetailModal
        application={detailApp}
        onClose={() => setApplicationQuery(null)}
        onStatusChange={(status) =>
          detailApp ? handleStatusChange(detailApp.id, status) : undefined
        }
      />
    </>
  );
}
