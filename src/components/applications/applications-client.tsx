"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition as useReactTransition,
} from "react";
import {
  animated,
  config,
  useReducedMotion,
  useSpring,
} from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  MapPin,
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  stages: ApplicationStageData[];
};

type ApplicationsClientProps = {
  companies: Array<{
    id: number;
    name: string;
  }>;
  items: ApplicationListItem[];
};

type BoardColumnDefinition = {
  status: ApplicationStatus;
  description: string;
};

type BoardState = Record<ApplicationStatus, ApplicationListItem[]>;

type FeedbackState =
  | { tone: "muted" | "danger"; message: string }
  | null;

const kanbanColumns: BoardColumnDefinition[] = [
  {
    status: "applied",
    description: "Candidaturas enviadas e aguardando retorno inicial.",
  },
  {
    status: "in_process",
    description: "Processos com entrevistas, testes ou próximas etapas abertas.",
  },
  {
    status: "offer",
    description: "Propostas recebidas e ainda em avaliação.",
  },
  {
    status: "approved",
    description: "Processos concluídos com resultado positivo.",
  },
  {
    status: "rejected",
    description: "Processos encerrados por rejeição.",
  },
  {
    status: "withdrawn",
    description: "Candidaturas encerradas por desistência.",
  },
];

const workModelLabels: Record<string, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};

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
) {
  let moved: ApplicationListItem | null = null;

  const nextBoard = Object.fromEntries(
    Object.entries(board).map(([status, items]) => {
      const typedStatus = status as ApplicationStatus;
      const nextItems = items.filter((item) => {
        if (item.id !== applicationId) {
          return true;
        }

        moved = { ...item, status: targetStatus };
        return false;
      });

      return [typedStatus, nextItems];
    }),
  ) as BoardState;

  if (!moved) {
    return board;
  }

  return {
    ...nextBoard,
    [targetStatus]: [moved, ...nextBoard[targetStatus]],
  };
}

function getHoveredColumn(
  clientX: number,
  clientY: number,
  draggedId: number,
): ApplicationStatus | null {
  if (typeof document === "undefined") {
    return null;
  }

  const elements = document.elementsFromPoint(clientX, clientY);

  for (const element of elements) {
    const draggedCard = element.closest<HTMLElement>(
      `[data-application-card-id="${draggedId}"]`,
    );

    if (draggedCard) {
      continue;
    }

    const column = element.closest<HTMLElement>("[data-kanban-column]");
    const status = column?.dataset.kanbanColumn;

    if (status && isApplicationStatus(status)) {
      return status;
    }
  }

  return null;
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
    stages: item.stages,
  };
}

function findApplicationById(
  board: BoardState,
  applicationId: number,
): ApplicationListItem | null {
  for (const items of Object.values(board)) {
    const match = items.find((item) => item.id === applicationId);
    if (match) {
      return match;
    }
  }

  return null;
}

function parseSelectedApplicationId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
}

function DraggableApplicationCard({
  item,
  activeDragId,
  onDragStart,
  onDragHoverColumn,
  onDrop,
  onOpenDetails,
  reducedMotion,
}: {
  item: ApplicationListItem;
  activeDragId: number | null;
  onDragStart: (item: ApplicationListItem) => void;
  onDragHoverColumn: (status: ApplicationStatus | null) => void;
  onDrop: (item: ApplicationListItem, targetStatus: ApplicationStatus | null) => void;
  onOpenDetails: () => void;
  reducedMotion: boolean;
}) {
  const workModelLabel = getWorkModelLabel(item.workModel);
  const seniorityLabel = getSeniorityLabel(item.seniority);
  const sourceNameLabel = getSourceNameLabel(item.sourceName);
  const isDragging = activeDragId === item.id;
  const [{ x, scale }, api] = useSpring(() => ({
    x: 0,
    scale: 1,
    config: config.stiff,
  }));

  const bindDrag = useDrag(
    ({ first, last, movement: [mx], xy: [clientX, clientY] }) => {
      if (first) {
        onDragStart(item);
      }

      if (!last) {
        const hoveredColumn = getHoveredColumn(clientX, clientY, item.id);
        onDragHoverColumn(hoveredColumn);

        api.start({
          x: mx,
          scale: reducedMotion ? 1 : 1.02,
          immediate: (key) => key === "x",
        });

        return;
      }

      const hoveredColumn = getHoveredColumn(clientX, clientY, item.id);
      onDragHoverColumn(null);
      onDrop(item, hoveredColumn);
      api.start({
        x: 0,
        scale: 1,
        immediate: false,
      });
    },
    {
      filterTaps: true,
      threshold: 4,
      pointer: { touch: true },
    },
  );

  return (
    <animated.div
      data-application-card-id={item.id}
      style={{ x, scale, zIndex: isDragging ? 120 : 1 }}
      className={cn(
        "relative will-change-transform touch-none",
        isDragging && "cursor-grabbing",
      )}
      {...bindDrag()}
    >
      <Card
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={onOpenDetails}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenDetails();
          }
        }}
        className={cn(
          "cursor-grab border border-border/60 bg-card/92 pt-0 transition-shadow duration-200 outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70",
          isDragging
            ? "cursor-grabbing shadow-[0_28px_96px_rgba(0,0,0,0.5)] ring-1 ring-amber-300/30"
            : "hover:shadow-[0_12px_36px_rgba(0,0,0,0.22)]",
        )}
      >
        <CardHeader className="border-b border-border/40 pt-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base text-foreground">
                    {item.jobTitle}
                  </CardTitle>
                  {item.company ? (
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="size-3.5 shrink-0 text-muted-foreground/70" />
                      <span className="truncate">{item.company}</span>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm italic text-muted-foreground/70">
                      Empresa não informada
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex flex-wrap gap-2">
            <ApplicationStatusBadge status={item.status} />
            {workModelLabel ? (
              <span className="inline-flex items-center rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {workModelLabels[item.workModel ?? ""] ?? workModelLabel}
              </span>
            ) : null}
            {seniorityLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/8 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-violet-300/80">
                <Zap className="size-3" />
                {seniorityLabel}
              </span>
            ) : null}
            {sourceNameLabel ? (
              <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/8 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sky-300/80">
                {sourceNameLabel}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </animated.div>
  );
}

function PreviewDropSlot({
  active,
  reducedMotion,
}: {
  active: boolean;
  reducedMotion: boolean;
}) {
  const [style, api] = useSpring(() => ({
    opacity: 0,
    height: 0,
    scale: 0.98,
    marginBottom: 0,
    config: config.gentle,
  }));

  useEffect(() => {
    api.start({
      opacity: active ? 1 : 0,
      height: active ? 156 : 0,
      scale: active ? 1 : 0.98,
      marginBottom: active ? 12 : 0,
      immediate: reducedMotion,
    });
  }, [active, api, reducedMotion]);

  return (
    <animated.div style={style} className="overflow-hidden">
      <div className="flex h-full rounded-2xl border border-dashed border-amber-300/35 bg-amber-300/8" />
    </animated.div>
  );
}

function KanbanColumn({
  activeColumn,
  activeDragId,
  containsActiveDrag,
  dragOriginStatus,
  items,
  onDragStart,
  onDragHoverColumn,
  onDrop,
  onOpenDetails,
  reducedMotion,
  status,
}: {
  activeColumn: ApplicationStatus | null;
  activeDragId: number | null;
  containsActiveDrag: boolean;
  dragOriginStatus: ApplicationStatus | null;
  items: ApplicationListItem[];
  onDragStart: (item: ApplicationListItem) => void;
  onDragHoverColumn: (status: ApplicationStatus | null) => void;
  onDrop: (item: ApplicationListItem, targetStatus: ApplicationStatus | null) => void;
  onOpenDetails: (item: ApplicationListItem) => void;
  reducedMotion: boolean;
  status: BoardColumnDefinition;
}) {
  const hasPreviewSlot =
    activeDragId !== null &&
    activeColumn === status.status &&
    dragOriginStatus !== null &&
    dragOriginStatus !== status.status;

  return (
    <section
      data-kanban-column={status.status}
      className={cn(
        "relative z-0 flex h-full min-h-[38rem] flex-col overflow-visible rounded-3xl border border-border/60 bg-card/50 backdrop-blur",
        containsActiveDrag && "z-[140]",
        activeColumn === status.status && "border-amber-300/50 bg-amber-300/8",
      )}
    >
      <div className="border-b border-border/50 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {applicationStatusLabelMap[status.status]}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {status.description}
            </p>
          </div>
          <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {items.length}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <PreviewDropSlot active={hasPreviewSlot} reducedMotion={reducedMotion} />
        {items.length === 0 ? (
          <Empty className="flex-1 border border-dashed border-border/50 bg-background/40">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPin />
              </EmptyMedia>
              <EmptyTitle>Nenhuma candidatura aqui</EmptyTitle>
              <EmptyDescription>
                {activeDragId
                  ? "Solte o card nesta coluna para mover o processo."
                  : "Quando uma candidatura entrar nesta etapa, ela aparecerá aqui."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          items.map((item) => (
            <div key={item.id} className={cn("relative", activeDragId === item.id && "z-[160]")}>
              <DraggableApplicationCard
                item={item}
                activeDragId={activeDragId}
                onDragStart={onDragStart}
                onDragHoverColumn={onDragHoverColumn}
                onDrop={onDrop}
                onOpenDetails={() => onOpenDetails(item)}
                reducedMotion={reducedMotion}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function ApplicationsClient({ companies, items }: ApplicationsClientProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [board, setBoard] = useState(() => createBoard(items));
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeColumn, setActiveColumn] = useState<ApplicationStatus | null>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [dragOriginStatus, setDragOriginStatus] = useState<ApplicationStatus | null>(null);
  const [isSavingMove, startSavingMove] = useReactTransition();
  const dragSnapshotRef = useRef<BoardState>(createBoard(items));

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

  function handleDragStart(item: ApplicationListItem) {
    dragSnapshotRef.current = board;
    setActiveDragId(item.id);
    setDragOriginStatus(item.status);
    setFeedback(null);
  }

  function handleDragHoverColumn(status: ApplicationStatus | null) {
    setActiveColumn(status);
  }

  function handleDrop(
    item: ApplicationListItem,
    targetStatus: ApplicationStatus | null,
  ) {
    if (!targetStatus || targetStatus === item.status) {
      setActiveColumn(null);
      setActiveDragId(null);
      setDragOriginStatus(null);
      return;
    }

    const snapshot = dragSnapshotRef.current;
    const nextBoard = moveCard(snapshot, item.id, targetStatus);

    setBoard(nextBoard);
    setActiveColumn(null);
    setActiveDragId(null);
    setDragOriginStatus(null);

    startSavingMove(async () => {
      const result = await updateApplicationStatus(item.id, targetStatus);

      if (!result.success) {
        setBoard(snapshot);
        setFeedback({
          tone: "danger",
          message:
            "Não foi possível atualizar o status da candidatura. O board voltou ao estado anterior.",
        });
        return;
      }

      setFeedback({
        tone: "muted",
        message: `Status atualizado para ${applicationStatusLabelMap[targetStatus]}.`,
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

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
              Board Kanban
            </p>
            <p className="text-sm text-muted-foreground">
              {totalCount === 0
                ? "Nenhuma candidatura registrada ainda"
                : totalCount === 1
                  ? "1 candidatura registrada"
                  : `${totalCount} candidaturas registradas`}
            </p>
          </div>

          <Button
            id="btn-nova-candidatura"
            size="lg"
            onClick={() => setCreateOpen(true)}
            className="h-11 min-w-44 justify-center rounded-xl bg-amber-300 px-6 text-zinc-950 shadow-[0_8px_28px_rgba(252,211,77,0.28)] transition-all hover:bg-amber-200 hover:shadow-[0_12px_36px_rgba(252,211,77,0.36)]"
          >
            <Waypoints data-icon="inline-start" />
            Nova candidatura
          </Button>
        </div>

        {(feedback !== null || isSavingMove) && (
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/40 px-4 py-3">
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
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-amber-200">
                Salvando movimento...
              </span>
            ) : null}
          </div>
        )}
      </div>

      {totalCount === 0 ? (
        <Empty className="rounded-3xl border border-dashed border-border/50 bg-card/40 py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPin />
            </EmptyMedia>
            <EmptyTitle>Nenhuma candidatura registrada</EmptyTitle>
            <EmptyDescription className="max-w-xs">
              Registre sua primeira candidatura e acompanhe o processo seletivo em um board Kanban.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-1 h-10 rounded-xl bg-amber-300 px-5 text-zinc-950 hover:bg-amber-200"
          >
            <Waypoints data-icon="inline-start" />
            Registrar primeira candidatura
          </Button>
        </Empty>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-max grid-flow-col auto-cols-[minmax(19rem,19rem)] gap-4">
            {kanbanColumns.map((column) => (
              <KanbanColumn
                key={column.status}
                status={column}
                items={board[column.status]}
                activeColumn={activeColumn}
                activeDragId={activeDragId}
                containsActiveDrag={board[column.status].some((item) => item.id === activeDragId)}
                dragOriginStatus={dragOriginStatus}
                onDragStart={handleDragStart}
                onDragHoverColumn={handleDragHoverColumn}
                onDrop={handleDrop}
                onOpenDetails={handleOpenDetails}
                reducedMotion={reducedMotion}
              />
            ))}
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
