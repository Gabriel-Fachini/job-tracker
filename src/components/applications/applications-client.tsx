"use client";

import {
  useState,
  useTransition as useReactTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Inbox,
  Waypoints,
  Zap,
} from "lucide-react";

import {
  ApplicationCreateModal,
} from "@/components/applications/application-create-modal";
import {
  ApplicationDetailModal,
  type ApplicationDetailData,
  type ApplicationStageData,
} from "@/components/applications/application-detail-modal";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  applicationStatusLabelMap,
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
};

type BoardState = Record<ApplicationStatus, ApplicationListItem[]>;

type FeedbackState =
  | { tone: "muted" | "danger"; message: string }
  | null;

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetails}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails();
        }
      }}
      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08] outline-none cursor-pointer"
    >
      {/* Title + company */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-foreground/90">
          {item.jobTitle}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="size-3 shrink-0 text-muted-foreground/60" />
          <span className="truncate">{item.company ?? "—"}</span>
        </div>
      </div>

      {/* Badges */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        {workModelLabel ? (
          <span className="inline-flex items-center rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {workModelLabel}
          </span>
        ) : null}
        {seniorityLabel ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/8 px-2 py-0.5 text-xs font-medium text-violet-300/80">
            <Zap className="size-3" />
            {seniorityLabel}
          </span>
        ) : null}
        {sourceNameLabel ? (
          <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/8 px-2 py-0.5 text-xs font-medium text-sky-300/80">
            {sourceNameLabel}
          </span>
        ) : null}
      </div>

      {/* Date */}
      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground/50 shrink-0 whitespace-nowrap">
        <CalendarDays className="size-3 shrink-0" />
        <span>{formatCardDate(item.appliedAt ?? item.createdAt)}</span>
      </div>

      {/* Status select */}
      <select
        value={item.status}
        onChange={(e) => {
          e.stopPropagation();
          onStatusChange(e.target.value as ApplicationStatus);
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-8 shrink-0 rounded-lg border border-input bg-input/30 px-2 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {applicationStatusLabelMap[status]}
          </option>
        ))}
      </select>

    </div>
  );
}

export function ApplicationsClient({ companies, items }: ApplicationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [board, setBoard] = useState(() => createBoard(items));
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSavingMove, startSavingMove] = useReactTransition();

  const initialTab = STATUS_ORDER.find((s) => createBoard(items)[s].length > 0) ?? "applied";
  const [activeTab, setActiveTab] = useState<ApplicationStatus>(initialTab);

  function setApplicationQuery(applicationId: number | null) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (applicationId === null) {
      nextParams.delete("applicationId");
    } else {
      nextParams.set("applicationId", String(applicationId));
    }

    const nextUrl = nextParams.size
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.push(nextUrl, { scroll: false });
  }

  function handleOpenDetails(item: ApplicationListItem) {
    setApplicationQuery(item.id);
  }

  function handleCloseDetails() {
    setApplicationQuery(null);
  }

  function handleStatusChange(item: ApplicationListItem, targetStatus: ApplicationStatus) {
    if (targetStatus === item.status) return;

    const snapshot = board;
    const nextBoard = moveCard(snapshot, item.id, targetStatus);

    setBoard(nextBoard);
    setFeedback(null);

    startSavingMove(async () => {
      const result = await updateApplicationStatus(item.id, targetStatus);

      if (!result.success) {
        setBoard(snapshot);
        setFeedback({
          tone: "danger",
          message: "Não foi possível atualizar o status. O estado foi revertido.",
        });
        return;
      }

      setFeedback({
        tone: "muted",
        message: `Movido para ${applicationStatusLabelMap[targetStatus]}.`,
      });
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

  const totalCount = items.length;
  const activeItems = board[activeTab];

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount === 0
              ? "Nenhuma candidatura registrada ainda"
              : totalCount === 1
                ? "1 candidatura registrada"
                : `${totalCount} candidaturas registradas`}
          </p>

          <Button
            size="lg"
            onClick={() => setCreateOpen(true)}
            className="h-10 w-full gap-2 rounded-xl border border-amber-300/25 bg-amber-300/8 px-5 text-foreground transition-colors hover:bg-amber-300/14 hover:border-amber-300/35 sm:w-auto"
          >
            <Waypoints className="size-4 shrink-0" />
            Nova candidatura
          </Button>
        </div>

        {/* Feedback */}
        {(feedback !== null || isSavingMove) && (
          <div className="flex min-h-9 items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-2">
            <p
              className={cn(
                "text-sm",
                feedback?.tone === "danger"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {feedback?.message}
            </p>
            {isSavingMove ? (
              <span className="text-xs font-medium text-amber-200">
                Salvando...
              </span>
            ) : null}
          </div>
        )}
      </div>

      {totalCount === 0 ? (
        <Empty className="rounded-3xl border border-dashed border-border/50 bg-card/40 py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>Nenhuma candidatura registrada</EmptyTitle>
            <EmptyDescription className="max-w-xs">
              Registre sua primeira candidatura e acompanhe o processo seletivo.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-1 h-10 rounded-xl border border-border/60 bg-card/60 px-5 text-foreground hover:bg-white/6"
          >
            <Waypoints data-icon="inline-start" />
            Registrar primeira candidatura
          </Button>
        </Empty>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card/50 overflow-hidden">
          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-border/50 scrollbar-none">
            {STATUS_ORDER.map((status) => {
              const count = board[status].length;
              const isActive = activeTab === status;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActiveTab(status)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "text-foreground after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-amber-300"
                      : "text-muted-foreground hover:text-foreground/80",
                  )}
                >
                  {applicationStatusLabelMap[status]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs tabular-nums font-medium",
                      isActive
                        ? "bg-amber-300/20 text-amber-200"
                        : "bg-white/6 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div key={activeTab} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-150">
            {activeItems.length === 0 ? (
              <Empty className="py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma candidatura aqui</EmptyTitle>
                  <EmptyDescription>
                    Quando uma candidatura entrar nesta etapa, ela aparecerá aqui.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="divide-y divide-border/30">
                {activeItems.map((item) => (
                  <ApplicationListRow
                    key={item.id}
                    item={item}
                    onOpenDetails={() => handleOpenDetails(item)}
                    onStatusChange={(status) => handleStatusChange(item, status)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ApplicationCreateModal
        companies={companies}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <ApplicationDetailModal
        application={detailApp}
        onClose={handleCloseDetails}
      />
    </>
  );
}
