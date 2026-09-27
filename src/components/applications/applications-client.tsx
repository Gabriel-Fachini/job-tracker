"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox, Plus } from "lucide-react";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { MetaLine } from "@/components/ui/meta-line";
import { TabBar, TabBarItem } from "@/components/ui/tab-bar";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";
import {
  applicationStatusLabelMap,
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/applications";
import {
  formatDate,
  getSeniorityLabel,
  getSourceNameLabel,
  getWorkModelLabel,
} from "@/lib/jobs";
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

function ApplicationListRow({
  item,
  onOpenDetails,
  onStatusChange,
}: {
  item: ApplicationListItem;
  onOpenDetails: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
}) {
  const date = item.appliedAt ?? item.createdAt;

  return (
    <li className="relative transition-colors duration-150 hover:bg-surface has-[>button:active]:bg-surface">
      {/* Stretched target: the whole row opens the detail sheet. */}
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={`Abrir candidatura: ${item.jobTitle}`}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />

      {/* Phones: status beside the title, meta line full width below.
          From sm: status centered on the right across both lines. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3.5 sm:gap-x-6 sm:px-5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-medium text-balance text-foreground">
          {item.jobTitle}
        </h3>
        <ApplicationStatusSelect
          value={item.status}
          onChange={onStatusChange}
          className="relative z-10 sm:row-span-2"
        />
        <MetaLine
          className="col-span-2 sm:col-span-1"
          items={[
            <span key="company" className={item.company ? "text-foreground" : undefined}>
              {item.company ?? "Empresa não informada"}
            </span>,
            getWorkModelLabel(item.workModel),
            getSeniorityLabel(item.seniority),
            getSourceNameLabel(item.sourceName),
            <time
              key="date"
              dateTime={date.toISOString()}
              className="font-data text-xs text-subtle-foreground"
            >
              {formatDate(date)}
            </time>,
          ]}
        />
      </div>
    </li>
  );
}

export function ApplicationsClient({ companies, items }: ApplicationsClientProps) {
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
  const inProcessCount = board.in_process.length;
  const activeItems = board[activeTab];

  return (
    <>
      <PageHeader
        title="Candidaturas"
        description={
          <>
            <span className="font-data text-foreground">{totalCount}</span>{" "}
            {totalCount === 1 ? "registrada" : "registradas"}
            <span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>
            <span className="font-data text-foreground">{inProcessCount}</span> em processo
          </>
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            <span className="sm:hidden">Nova</span>
            <span className="hidden sm:inline">Nova candidatura</span>
          </Button>
        }
      />

      {totalCount === 0 ? (
        <section
          aria-label="Candidaturas"
          className="-mx-4 border-y border-border sm:mx-0 sm:rounded-xl sm:border-x"
        >
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Nenhuma candidatura registrada</EmptyTitle>
              <EmptyDescription>
                Registre a vaga, o status inicial e acompanhe cada etapa do processo seletivo aqui.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus data-icon="inline-start" />
                Registrar primeira candidatura
              </Button>
            </EmptyContent>
          </Empty>
        </section>
      ) : (
        <section
          aria-label="Candidaturas por status"
          className="-mx-4 border-y border-border sm:mx-0 sm:rounded-xl sm:border-x"
        >
          <TabBar ref={tabListRef} aria-label="Status" className="px-1 sm:px-2">
            {STATUS_ORDER.map((status) => (
              <TabBarItem
                key={status}
                ref={(node) => {
                  tabRefs.current[status] = node;
                }}
                selected={activeTab === status}
                count={board[status].length}
                onClick={() => setActiveTab(status)}
              >
                {applicationStatusLabelMap[status]}
              </TabBarItem>
            ))}
          </TabBar>

          <div
            key={activeTab}
            role="tabpanel"
            aria-label={applicationStatusLabelMap[activeTab]}
            className="animate-in fade-in-0 duration-150"
          >
            {activeItems.length === 0 ? (
              <Empty className="py-14">
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
              <ul className="divide-y divide-border">
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
