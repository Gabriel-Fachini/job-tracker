"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CircleSlash,
  Clock3,
  ExternalLink,
  FileText,
  FileUp,
  FolderOpen,
  Loader2,
  FileX2,
  Hash,
  Layers3,
  PencilLine,
  Plus,
  RadioTower,
  Sparkles,
  Trash2,
  Users2,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { JobMarkdown } from "@/components/applications/job-markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { type ApplicationStatus } from "@/lib/applications";
import {
  getSeniorityLabel,
  getSourceNameLabel,
  getWorkModelLabel,
  seniorityOptions,
  sourceNameOptions,
  workModelOptions,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";
import {
  createApplicationStage,
  deleteApplicationStage,
  formatApplicationDescriptionWithAi,
  updateApplicationDescription,
  updateApplicationNotes,
  updateApplicationStage,
  updateJobContext,
} from "@/server/actions/applications";
import { generateResume, openResumeInFinder } from "@/server/actions/resume";

export type ApplicationStageData = {
  id: number;
  label: string;
  date: Date;
  notes: string | null;
  createdAt: Date;
};

export type ApplicationDetailData = {
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

type UsedResumeStatus = "unknown" | "uploaded" | "empty";

type MetaItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type TimelineItem = ApplicationStageData & {
  durationLabel: string;
  isCurrent: boolean;
};

type ApplicationDetailModalProps = {
  application: ApplicationDetailData | null;
  onClose: () => void;
};

type StageFormState = {
  label: string;
  date: string;
  notes: string;
};

// Color system
const COLORS = {
  card: {
    border: "border-zinc-700/70",
    bg: "bg-zinc-950/75",
  },
  divider: {
    border: "border-zinc-700/70",
  },
  metadata: {
    border: "border-zinc-800/80",
    bg: "bg-zinc-950/75",
  },
} as const;

const controlClassName =
  "h-10 w-full rounded-xl border border-border/70 bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const textareaClassName =
  "min-h-24 w-full rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const primarySectionClassName =
  "rounded-2xl border border-zinc-700/80 bg-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

const secondarySectionClassName =
  "rounded-2xl border border-zinc-800/90 bg-zinc-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";

const tertiarySectionClassName =
  "rounded-2xl border border-zinc-800/80 bg-black/30";

export function ApplicationDetailModal({
  application,
  onClose,
}: ApplicationDetailModalProps) {
  if (!application) return null;

  const usedResumeStatus = normalizeUsedResumeStatus(application.usedResumeStatus);
  const orderedStages = [...application.stages].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const currentStage = orderedStages.at(-1) ?? null;
  const currentStageHealth = getStageHealth(currentStage?.date ?? null);
  const timelineItems = buildTimelineItems(orderedStages);

  return (
    <Dialog open={!!application} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border/50 px-6 pb-5 pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-2">
                  <ApplicationStatusBadge status={application.status} />
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                    Detalhes da candidatura
                  </p>
                </div>

                <div className="min-w-0">
                  <DialogTitle className="text-xl leading-tight text-balance sm:text-2xl">
                    {application.jobTitle}
                  </DialogTitle>
                  <DialogDescription className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="size-3.5 shrink-0 text-muted-foreground/60" />
                    <span>{application.company ?? "Empresa não informada"}</span>
                  </DialogDescription>
                </div>
              </div>

            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-6">
              <CurrentStageCard currentStage={currentStage} />

              <section className={primarySectionClassName}>
                <div className="flex flex-col gap-3 border-b border-border/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <SectionEyebrow>Timeline de etapas</SectionEyebrow>
                    <h3 className="mt-1 text-base font-semibold text-foreground">
                      Acompanhamento manual do processo
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Registre a etapa atual, mantenha notas curtas e acompanhe o tempo entre eventos.
                    </p>
                  </div>

                  <StageComposer
                    applicationId={application.id}
                    triggerLabel="Adicionar etapa"
                    empty={orderedStages.length === 0}
                  />
                </div>

                <div className="px-5 py-5">
                  {timelineItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/30 px-5 py-8 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Nenhuma etapa registrada ainda.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Comece pela triagem, teste técnico ou qualquer etapa real do processo seletivo.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {timelineItems.map((stage, index) => (
                        <TimelineStageItem
                          key={`${stage.id}:${stage.date.getTime()}:${stage.label}:${stage.notes ?? ""}`}
                          stage={stage}
                          isLast={index === timelineItems.length - 1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className={secondarySectionClassName}>
                <div className="border-b border-border/40 px-5 py-4">
                  <SectionEyebrow>Currículo</SectionEyebrow>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    PDF enviado e geração por IA
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <UsedResumeSection
                    applicationId={application.id}
                    status={usedResumeStatus}
                    originalFilename={application.usedResumeOriginalFilename}
                    savedGeneratedResumePath={application.generatedResumePath}
                  />
                </div>
              </section>

              <section className={secondarySectionClassName}>
                <div className="border-b border-border/40 px-5 py-4">
                  <SectionEyebrow>Notas</SectionEyebrow>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    Contexto rápido da candidatura
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <NotesEditor
                    key={`${application.id}:${application.updatedAt.getTime()}:${application.notes ?? ""}`}
                    applicationId={application.id}
                    initialNotes={application.notes}
                  />
                </div>
              </section>

              <section className={tertiarySectionClassName}>
                <div className="border-b border-border/40 px-5 py-4">
                  <SectionEyebrow>Descrição</SectionEyebrow>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    Descrição da vaga salva localmente
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <DescriptionEditor
                    key={`${application.id}:${application.updatedAt.getTime()}:${application.description ?? ""}`}
                    applicationId={application.id}
                    initialDescription={application.description}
                  />
                </div>
              </section>
            </div>

            <aside className="flex min-w-0 flex-col gap-4">
              <section className={primarySectionClassName}>
                <div className="border-b border-border/40 px-5 py-4">
                  <SectionEyebrow>Resumo</SectionEyebrow>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    Sinais principais
                  </h3>
                </div>
                <div className="space-y-3 px-5 py-5">
                  <SummaryMetric
                    icon={Workflow}
                    label="Etapas registradas"
                    value={String(orderedStages.length)}
                  />
                  <SummaryMetric
                    icon={Clock3}
                    label="Tempo na etapa atual"
                    value={
                      currentStage
                        ? formatDuration(currentStage.date, new Date())
                        : "Sem etapa"
                    }
                    valueClassName={currentStageHealth.valueClassName}
                  />
                  <SummaryMetric
                    icon={FileText}
                    label="Última atualização"
                    value={formatLongDate(application.updatedAt)}
                  />
                  {application.sourceUrl ? (
                    <a
                      href={application.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-9 w-full rounded-xl border-zinc-700/80 bg-zinc-950/70 text-xs",
                      )}
                    >
                      Abrir vaga original
                      <ExternalLink data-icon="inline-end" className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              </section>

              <section className={tertiarySectionClassName}>
                <MetadataEditor
                  key={`metadata:${application.id}:${application.updatedAt.getTime()}`}
                  applicationId={application.id}
                  initialSourceName={application.sourceName}
                  initialWorkModel={application.workModel}
                  initialSeniority={application.seniority}
                  initialIsReferral={application.isReferral}
                  appId={`APP-${application.id}`}
                  company={application.company}
                  createdAt={application.createdAt}
                />
              </section>
            </aside>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border/50 px-6 py-4">
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CurrentStageCard({
  currentStage,
}: {
  currentStage: ApplicationStageData | null;
}) {
  const health = getStageHealth(currentStage?.date ?? null);

  return (
    <section
      className={cn(
        "rounded-2xl px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        health.containerClassName,
      )}
    >
      <SectionEyebrow>Etapa atual</SectionEyebrow>
      {currentStage ? (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {currentStage.label}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Em andamento desde {formatLongDate(currentStage.date)}.
            </p>
            <p className={cn("mt-2 text-sm font-medium", health.messageClassName)}>
              {health.message}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl px-3 py-2 text-right",
              health.metricClassName,
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
              Tempo acumulado
            </p>
            <p className={cn("mt-1 text-sm font-semibold", health.valueClassName)}>
              {formatDuration(currentStage.date, new Date())}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <h3 className="text-lg font-semibold text-foreground">
            Ainda sem etapa definida
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use a timeline abaixo para registrar o primeiro marco real deste processo seletivo.
          </p>
        </div>
      )}
    </section>
  );
}

function StageComposer({
  applicationId,
  triggerLabel,
  empty,
}: {
  applicationId: number;
  triggerLabel: string;
  empty: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<StageFormState>(() => createEmptyStageForm());

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("label", fields.label);
    formData.set("date", fields.date);
    formData.set("notes", fields.notes);

    startTransition(async () => {
      const result = await createApplicationStage(applicationId, formData);

      if (!result.success) {
        setError(getMutationErrorMessage(result.error));
        return;
      }

      setFields(createEmptyStageForm());
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="w-full sm:w-auto">
      {!open ? (
        <Button
          type="button"
          variant={empty ? "default" : "outline"}
          onClick={() => setOpen(true)}
          className={cn(
            "w-full rounded-xl sm:w-auto",
            empty && "bg-amber-300 text-zinc-950 hover:bg-amber-200",
          )}
        >
          <Plus data-icon="inline-start" className="size-4" />
          {empty ? "Registrar primeira etapa" : triggerLabel}
        </Button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className={cn("rounded-2xl p-4 sm:min-w-[22rem]", COLORS.card.border, COLORS.card.bg)}
        >
          <div className="grid gap-3">
            <Input
              value={fields.label}
              onChange={(event) =>
                setFields((current) => ({ ...current, label: event.target.value }))
              }
              placeholder="Ex.: Triagem RH"
              className={controlClassName}
            />
            <Input
              type="date"
              value={fields.date}
              onChange={(event) =>
                setFields((current) => ({ ...current, date: event.target.value }))
              }
              className={controlClassName}
            />
            <Textarea
              value={fields.notes}
              onChange={(event) =>
                setFields((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Notas rápidas da etapa"
              className={textareaClassName}
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                  setFields(createEmptyStageForm());
                }}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="rounded-xl">
                {isPending ? "Salvando..." : "Salvar etapa"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function UsedResumeSection({
  applicationId,
  status,
  originalFilename,
  savedGeneratedResumePath,
}: {
  applicationId: number;
  status: UsedResumeStatus;
  originalFilename: string | null;
  savedGeneratedResumePath: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resumePhase, setResumePhase] = useState<"idle" | "generating" | "done" | "error">(
    savedGeneratedResumePath ? "done" : "idle"
  );
  const [pdfPath, setPdfPath] = useState<string | null>(savedGeneratedResumePath);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  function handleGenerateResume() {
    setResumeError(null);
    setResumePhase("generating");
    startGenerating(async () => {
      const result = await generateResume(applicationId);
      if (result.success) {
        setPdfPath(result.filePath);
        setResumePhase("done");
      } else {
        setResumeError(result.error);
        setResumePhase("error");
      }
    });
  }

  function handleOpenInFinder() {
    const path = pdfPath ?? savedGeneratedResumePath;
    if (path) openResumeInFinder(path);
  }

  async function uploadResume(file: File) {
    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch(`/api/applications/${applicationId}/resume`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as
      | { ok: true }
      | { ok: false; error: string };

    if (!payload.ok) {
      throw new Error(payload.error);
    }
  }

  async function markResumeAsEmpty() {
    const formData = new FormData();
    formData.set("mode", "empty");

    const response = await fetch(`/api/applications/${applicationId}/resume`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as
      | { ok: true }
      | { ok: false; error: string };

    if (!payload.ok) {
      throw new Error(payload.error);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await uploadResume(file);
        router.refresh();
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Falha ao salvar o currículo desta candidatura.",
        );
      } finally {
        event.target.value = "";
      }
    });
  }

  function handleMarkAsEmpty() {
    setError(null);

    startTransition(async () => {
      try {
        await markResumeAsEmpty();
        router.refresh();
      } catch (mutationError) {
        setError(
          mutationError instanceof Error
            ? mutationError.message
            : "Falha ao atualizar o status do currículo desta candidatura.",
        );
      }
    });
  }

  async function markResumeAsUnknown() {
    const formData = new FormData();
    formData.set("mode", "unknown");

    const response = await fetch(`/api/applications/${applicationId}/resume`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as
      | { ok: true }
      | { ok: false; error: string };

    if (!payload.ok) {
      throw new Error(payload.error);
    }
  }

  function handleMarkAsUnknown() {
    setError(null);

    startTransition(async () => {
      try {
        await markResumeAsUnknown();
        router.refresh();
      } catch (mutationError) {
        setError(
          mutationError instanceof Error
            ? mutationError.message
            : "Falha ao atualizar o status do currículo desta candidatura.",
        );
      }
    });
  }

  return (
    <div className={cn("rounded-2xl overflow-hidden", COLORS.card.border, COLORS.card.bg)}>
      {status === "empty" ? (
        /* Compact closed state — no AI generation section */
        <div className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-amber-100">
              <FileX2 className="size-4" />
              <p className="text-sm font-semibold">Candidatura sem currículo</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-100">
                Sem currículo
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={handleMarkAsUnknown}
                className="rounded-xl text-muted-foreground"
              >
                {isPending ? (
                  <Loader2 data-icon="inline-start" className="size-3.5 animate-spin" />
                ) : null}
                Desfazer
              </Button>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      ) : (
        <>
          {/* Row 1: Upload prompt — hidden when any resume is associated */}
          {status !== "uploaded" && resumePhase !== "done" && (
            <div className={cn("p-4 border-b", COLORS.divider.border)}>
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-foreground">
                    <FileUp className="size-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Nenhum currículo vinculado ainda</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Salve o PDF enviado nesta vaga ou marque explicitamente que esta candidatura foi feita sem currículo.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "cursor-pointer rounded-xl bg-amber-300 text-zinc-950 hover:bg-amber-200",
                    )}
                  >
                    <FileUp data-icon="inline-start" className="size-3.5" />
                    Enviar PDF
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={handleFileSelection}
                      disabled={isPending}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={handleMarkAsEmpty}
                    className="rounded-xl"
                  >
                    <CircleSlash data-icon="inline-start" className="size-3.5" />
                    Marcar como sem currículo
                  </Button>
                </div>
              </div>

              {error ? (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              ) : null}
              {isPending ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Atualizando o registro do currículo...
                </div>
              ) : null}
            </div>
          )}

          {/* Row 2: AI Generation */}
          <div className="p-4">
            <SectionEyebrow>Geração por IA</SectionEyebrow>
            <h3 className="mt-1 text-sm font-semibold text-foreground">Currículo personalizado para esta vaga</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              A IA seleciona e reescreve os bullet points e habilidades mais relevantes para esta vaga.
            </p>
            {resumePhase === "error" && resumeError ? (
              <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resumeError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {resumePhase === "done" && pdfPath ? (
                <>
                  <span className="text-sm text-emerald-400">Currículo gerado.</span>
                  <a
                    href={`/api/applications/${applicationId}/generated-resume`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                  >
                    Abrir PDF
                  </a>
                  <Button type="button" variant="ghost" size="sm" onClick={handleOpenInFinder} className="rounded-xl gap-1.5 text-muted-foreground">
                    <FolderOpen className="size-3.5" />
                    Finder
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleGenerateResume} disabled={isGenerating} className="rounded-xl gap-1.5 text-muted-foreground">
                    Gerar novamente
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={handleGenerateResume} disabled={isGenerating} className="rounded-xl gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
                  {isGenerating ? (
                    <><Loader2 className="size-3.5 animate-spin" />Gerando...</>
                  ) : (
                    <><Sparkles className="size-3.5" />{resumePhase === "error" ? "Tentar novamente" : "Gerar Currículo"}</>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Row 3: PDF preview — inside the same card, no layout shift */}
          {resumePhase === "done" && pdfPath ? (
            <div className={cn("border-t", COLORS.divider.border)}>
              <iframe
                src={`/api/applications/${applicationId}/generated-resume`}
                className="w-full"
                style={{ height: "min(780px, 65vh)" }}
                title="Preview do currículo gerado"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function TimelineStageItem({
  stage,
  isLast,
}: {
  stage: TimelineItem;
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<StageFormState>(() => createStageFormFromStage(stage));

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("label", fields.label);
    formData.set("date", fields.date);
    formData.set("notes", fields.notes);

    startTransition(async () => {
      const result = await updateApplicationStage(stage.id, formData);

      if (!result.success) {
        setError(getMutationErrorMessage(result.error));
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Excluir a etapa "${stage.label}"?`)) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await deleteApplicationStage(stage.id);

      if (!result.success) {
        setError(getMutationErrorMessage(result.error));
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="relative pl-11">
      {!isLast ? (
        <div className="absolute bottom-[-1rem] left-4 top-8 w-px -translate-x-1/2 bg-gradient-to-b from-emerald-300/55 via-emerald-400/35 to-emerald-500/10" />
      ) : null}
      <div
        className={cn(
          "absolute left-4 top-8 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[0_0_0_4px_rgba(9,9,11,0.92)]",
          stage.isCurrent
            ? "border-amber-200/80 bg-amber-300 shadow-[0_0_0_4px_rgba(120,53,15,0.24)]"
            : "border-emerald-300/45 bg-emerald-400/80",
        )}
      />

      <div
        className={cn(
          "relative rounded-2xl border px-5 py-4",
          stage.isCurrent
            ? "border-amber-300/30 bg-amber-300/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            : "border-emerald-500/15 bg-emerald-400/[0.04]",
        )}
      >
        {!isEditing ? (
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">
                    {stage.label}
                  </h4>
                  {stage.isCurrent ? (
                    <span className="inline-flex items-center rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-100">
                      Atual
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatLongDate(stage.date)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium",
                    stage.isCurrent
                      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                      : "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-50/80",
                  )}
                >
                  {stage.durationLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <PencilLine data-icon="inline-start" className="size-3.5" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 data-icon="inline-start" className="size-3.5" />
                  Excluir
                </Button>
              </div>
            </div>

            {stage.notes ? (
              <>
                <Separator className="my-4 bg-border/40" />
                <p className="text-sm leading-6 text-foreground/80">{stage.notes}</p>
              </>
            ) : null}

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSave} className="grid gap-3">
            <Input
              value={fields.label}
              onChange={(event) =>
                setFields((current) => ({ ...current, label: event.target.value }))
              }
              className={controlClassName}
            />
            <Input
              type="date"
              value={fields.date}
              onChange={(event) =>
                setFields((current) => ({ ...current, date: event.target.value }))
              }
              className={controlClassName}
            />
            <Textarea
              value={fields.notes}
              onChange={(event) =>
                setFields((current) => ({ ...current, notes: event.target.value }))
              }
              className={textareaClassName}
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                  setFields(createStageFormFromStage(stage));
                }}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="rounded-xl">
                {isPending ? "Salvando..." : "Salvar mudanças"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DescriptionEditor({
  applicationId,
  initialDescription,
}: {
  applicationId: number;
  initialDescription: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isFormatting, setIsFormatting] = useState(false);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [error, setError] = useState<string | null>(null);

  const hasChanges = description.trim() !== (initialDescription ?? "").trim();

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateApplicationDescription(applicationId, description);

      if (!result.success) {
        setError(getMutationErrorMessage(result.error));
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  }

  async function handleFormat() {
    setError(null);
    setIsFormatting(true);

    try {
      const result = await formatApplicationDescriptionWithAi(description);

      if (!result.success) {
        setError(result.error);
      } else {
        setDescription(result.formatted);
      }
    } catch (err) {
      setError("Erro ao formatar a descrição.");
    } finally {
      setIsFormatting(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <JobMarkdown
          content={initialDescription}
          className="rounded-xl border border-border/50 bg-muted/15 p-5"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsEditing(true);
            setDescription(initialDescription ?? "");
          }}
          className="rounded-xl w-fit"
        >
          <PencilLine data-icon="inline-start" className="size-4" />
          Editar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="grid gap-3">
      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Descrição da vaga..."
        className={cn(textareaClassName, "min-h-32")}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleFormat}
          disabled={isFormatting || !description.trim()}
          className="rounded-xl"
        >
          {isFormatting ? (
            <>
              <Loader2 data-icon="inline-start" className="size-4 animate-spin" />
              Formatando...
            </>
          ) : (
            <>
              <Sparkles data-icon="inline-start" className="size-4" />
              Formatar com IA
            </>
          )}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsEditing(false);
              setDescription(initialDescription ?? "");
              setError(null);
            }}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isPending || !hasChanges}
            className="rounded-xl"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function NotesEditor({
  applicationId,
  initialNotes,
}: {
  applicationId: number;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);

  const hasChanges = notes.trim() !== (initialNotes ?? "").trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateApplicationNotes(applicationId, notes);

      if (!result.success) {
        setError(getMutationErrorMessage(result.error));
        return;
      }

      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Ex.: resposta rápida da recrutadora, alinhamento salarial, próximos passos."
        className={cn(textareaClassName, "min-h-32")}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Atualize aqui somente o contexto que ajuda a decidir a próxima ação.
        </p>
        <Button
          type="submit"
          disabled={isPending || !hasChanges}
          className="rounded-xl"
        >
          {isPending ? "Salvando..." : "Salvar notas"}
        </Button>
      </div>
    </form>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl p-3", COLORS.metadata.border, COLORS.metadata.bg)}>
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 text-muted-foreground/60" />
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
          {label}
        </p>
      </div>
      <p className={cn("mt-2 text-sm font-semibold text-foreground", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
      {children}
    </p>
  );
}

function MetadataEditor({
  applicationId,
  initialSourceName,
  initialWorkModel,
  initialSeniority,
  initialIsReferral,
  appId,
  company,
  createdAt,
}: {
  applicationId: number;
  initialSourceName: string | null;
  initialWorkModel: string | null;
  initialSeniority: string | null;
  initialIsReferral: boolean;
  appId: string;
  company: string | null;
  createdAt: Date;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [sourceName, setSourceName] = useState(initialSourceName ?? "");
  const [workModel, setWorkModel] = useState(initialWorkModel ?? "");
  const [seniority, setSeniority] = useState(initialSeniority ?? "");
  const [isReferral, setIsReferral] = useState(initialIsReferral);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleEdit() {
    setSourceName(initialSourceName ?? "");
    setWorkModel(initialWorkModel ?? "");
    setSeniority(initialSeniority ?? "");
    setIsReferral(initialIsReferral);
    setError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await updateJobContext(applicationId, {
        sourceName: sourceName || null,
        workModel: workModel || null,
        seniority: seniority || null,
        isReferral,
      });

      if (!result.success) {
        setError(getMutationErrorMessage(result.error));
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  }

  const staticItems: MetaItem[] = [
    { label: "Candidatura", value: appId, icon: Hash },
    { label: "Empresa", value: company ?? "Não informada", icon: Building2 },
    { label: "Registrada em", value: formatLongDate(createdAt), icon: CalendarDays },
  ];

  return (
    <>
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div>
          <SectionEyebrow>Metadados</SectionEyebrow>
          <h3 className="mt-1 text-base font-semibold text-foreground">Contexto da vaga</h3>
        </div>
        {!isEditing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="rounded-xl text-muted-foreground"
          >
            <PencilLine className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 px-5 py-5">
        {staticItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn("rounded-xl p-3", COLORS.metadata.border, COLORS.metadata.bg)}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="size-3 text-muted-foreground/60" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                  {item.label}
                </p>
              </div>
              <p className="mt-2 text-sm font-medium leading-5 text-foreground/90">
                {item.value}
              </p>
            </div>
          );
        })}

        {isEditing ? (
          <>
            <div className={cn("rounded-xl p-3", COLORS.metadata.border, COLORS.metadata.bg)}>
              <div className="flex items-center gap-1.5 mb-2">
                <RadioTower className="size-3 text-muted-foreground/60" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                  Origem
                </p>
              </div>
              <select
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                className={controlClassName}
              >
                <option value="">Não informada</option>
                {sourceNameOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className={cn("rounded-xl p-3", COLORS.metadata.border, COLORS.metadata.bg)}>
              <div className="flex items-center gap-1.5 mb-2">
                <Layers3 className="size-3 text-muted-foreground/60" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                  Modelo
                </p>
              </div>
              <select
                value={workModel}
                onChange={(e) => setWorkModel(e.target.value)}
                className={controlClassName}
              >
                <option value="">Não informado</option>
                {workModelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className={cn("rounded-xl p-3", COLORS.metadata.border, COLORS.metadata.bg)}>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="size-3 text-muted-foreground/60" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                  Senioridade
                </p>
              </div>
              <select
                value={seniority}
                onChange={(e) => setSeniority(e.target.value)}
                className={controlClassName}
              >
                <option value="">Não informada</option>
                {seniorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className={cn("rounded-xl p-3", COLORS.metadata.border, COLORS.metadata.bg)}>
              <div className="flex items-center gap-1.5 mb-2">
                <Users2 className="size-3 text-muted-foreground/60" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                  Indicação
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReferral}
                  onChange={(e) => setIsReferral(e.target.checked)}
                  className="size-4 rounded"
                />
                <span className="text-sm text-foreground/90">Candidatura por indicação</span>
              </label>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl"
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </>
        ) : (
          <>
            {[
              { label: "Origem", value: getSourceNameLabel(initialSourceName) ?? "Não informada", icon: RadioTower },
              { label: "Modelo", value: getWorkModelLabel(initialWorkModel) ?? "Não informado", icon: Layers3 },
              { label: "Senioridade", value: getSeniorityLabel(initialSeniority) ?? "Não informada", icon: Sparkles },
              { label: "Indicação", value: initialIsReferral ? "Sim" : "Não", icon: Users2 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn("rounded-xl p-3", COLORS.metadata.border, COLORS.metadata.bg)}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3 text-muted-foreground/60" />
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-5 text-foreground/90">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

function buildTimelineItems(stages: ApplicationStageData[]): TimelineItem[] {
  return stages
    .map((stage, index) => {
      const nextStage = stages[index + 1];

      return {
        ...stage,
        durationLabel: formatDuration(stage.date, nextStage?.date ?? new Date()),
        isCurrent: index === stages.length - 1,
      };
    })
    .reverse();
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatDuration(start: Date, end: Date) {
  const rawDays = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 86_400_000),
  );

  if (rawDays === 0) {
    return "Hoje";
  }

  if (rawDays === 1) {
    return "1 dia";
  }

  if (rawDays < 14) {
    return `${rawDays} dias`;
  }

  const weeks = Math.floor(rawDays / 7);
  if (weeks < 8) {
    return weeks === 1 ? "1 semana" : `${weeks} semanas`;
  }

  const months = Math.floor(rawDays / 30);
  if (months < 12) {
    return months === 1 ? "1 mês" : `${months} meses`;
  }

  const years = Math.floor(rawDays / 365);
  return years === 1 ? "1 ano" : `${years} anos`;
}

function createEmptyStageForm(): StageFormState {
  return {
    label: "",
    date: toDateInputValue(new Date()),
    notes: "",
  };
}

function createStageFormFromStage(stage: ApplicationStageData): StageFormState {
  return {
    label: stage.label,
    date: toDateInputValue(stage.date),
    notes: stage.notes ?? "",
  };
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMutationErrorMessage(
  error: "validation" | "not_found",
) {
  if (error === "not_found") {
    return "A candidatura ou etapa não foi encontrada.";
  }

  return "Revise os campos obrigatórios antes de salvar.";
}

function normalizeUsedResumeStatus(value: string | null | undefined): UsedResumeStatus {
  if (value === "uploaded" || value === "empty") {
    return value;
  }

  return "unknown";
}

function getStageHealth(date: Date | null) {
  if (!date) {
    return {
      containerClassName:
        "border border-zinc-700/80 bg-zinc-950/70",
      metricClassName:
        "border border-zinc-700/70 bg-zinc-950/75",
      valueClassName: "text-foreground",
      messageClassName: "text-muted-foreground",
      message: "Registre uma etapa para começar a acompanhar o tempo do processo.",
    };
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 86_400_000),
  );

  if (days <= 14) {
    return {
      containerClassName:
        "border border-emerald-400/25 bg-emerald-400/10",
      metricClassName:
        "border border-emerald-400/20 bg-emerald-950/35",
      valueClassName: "text-emerald-100",
      messageClassName: "text-emerald-200",
      message: "Dentro do tempo razoável para esta etapa.",
    };
  }

  if (days <= 30) {
    return {
      containerClassName:
        "border border-amber-400/25 bg-amber-400/10",
      metricClassName:
        "border border-amber-400/20 bg-amber-950/35",
      valueClassName: "text-amber-100",
      messageClassName: "text-amber-200",
      message: "Exige atenção. Vale considerar follow-up ou reavaliar o próximo passo.",
    };
  }

  return {
    containerClassName:
      "border border-rose-400/25 bg-rose-400/10",
    metricClassName:
      "border border-rose-400/20 bg-rose-950/35",
    valueClassName: "text-rose-100",
    messageClassName: "text-rose-200",
    message: "Parado há bastante tempo. Pode fazer sentido encerrar como recusada ou cancelada.",
  };
}
