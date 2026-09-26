"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CircleSlash,
  ExternalLink,
  FileUp,
  FileX2,
  Loader2,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";

import { ApplicationStatusSelect } from "@/components/applications/application-status-select";
import { JobMarkdown } from "@/components/applications/job-markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { generateResume } from "@/server/actions/resume";

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

type TimelineItem = ApplicationStageData & {
  durationLabel: string;
  isCurrent: boolean;
};

type ApplicationDetailModalProps = {
  application: ApplicationDetailData | null;
  onClose: () => void;
  onStatusChange?: (status: ApplicationStatus) => void;
};

type StageFormState = {
  label: string;
  date: string;
  notes: string;
};

const controlClassName =
  "h-10 w-full rounded-xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const textareaClassName =
  "min-h-24 w-full rounded-xl border border-input bg-input/30 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** The one bordered surface a section may use; sections themselves stay flat. */
const panelClassName = "rounded-2xl border border-border/60 bg-background/40";

export function ApplicationDetailModal({
  application,
  onClose,
  onStatusChange,
}: ApplicationDetailModalProps) {
  // Keep the last application rendered while the sheet animates closed.
  const [rendered, setRendered] = useState(application);
  if (application && application !== rendered) {
    setRendered(application);
  }

  if (!rendered) return null;

  return (
    <Dialog open={application !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        sheetSize="full"
        className="flex flex-col gap-0 p-0 sm:max-h-[92vh] sm:max-w-5xl"
      >
        <ApplicationDetailBody
          key={rendered.id}
          application={rendered}
          onClose={onClose}
          onStatusChange={onStatusChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function ApplicationDetailBody({
  application,
  onClose,
  onStatusChange,
}: {
  application: ApplicationDetailData;
  onClose: () => void;
  onStatusChange?: (status: ApplicationStatus) => void;
}) {
  const [isComposingStage, setIsComposingStage] = useState(false);
  const usedResumeStatus = normalizeUsedResumeStatus(application.usedResumeStatus);
  const orderedStages = [...application.stages].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const currentStage = orderedStages.at(-1) ?? null;
  const timelineItems = buildTimelineItems(orderedStages);

  return (
    <>
      <DialogHeader className="shrink-0 gap-3 border-b border-border/50 px-4 pt-5 pr-14 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <div className="flex flex-wrap items-center gap-2">
          {onStatusChange ? (
            <ApplicationStatusSelect value={application.status} onChange={onStatusChange} />
          ) : null}
          {application.isReferral ? (
            <Chip tone="info">
              <Users2 aria-hidden />
              Indicação
            </Chip>
          ) : null}
        </div>
        <div className="min-w-0">
          <DialogTitle className="text-xl leading-tight text-balance sm:text-2xl">
            {application.jobTitle}
          </DialogTitle>
          <DialogDescription className="mt-2 flex items-center gap-1.5 text-sm">
            <Building2 aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{application.company ?? "Empresa não informada"}</span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-8 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
          <div className="flex min-w-0 flex-col gap-8">
            <CurrentStageCard currentStage={currentStage} />

            <DetailSection
              title="Etapas"
              action={
                !isComposingStage ? (
                  <Button
                    type="button"
                    variant={orderedStages.length === 0 ? "brand" : "outline"}
                    size="sm"
                    onClick={() => setIsComposingStage(true)}
                    className="rounded-lg"
                  >
                    <Plus data-icon="inline-start" />
                    {orderedStages.length === 0 ? "Registrar primeira" : "Adicionar"}
                  </Button>
                ) : null
              }
            >
              {isComposingStage ? (
                <StageComposer
                  applicationId={application.id}
                  onDone={() => setIsComposingStage(false)}
                />
              ) : null}

              {timelineItems.length === 0 ? (
                !isComposingStage ? (
                  <p className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-sm leading-6 text-pretty text-muted-foreground">
                    Registre triagem, teste técnico ou qualquer etapa real para acompanhar o tempo entre eventos.
                  </p>
                ) : null
              ) : (
                <ol className="flex flex-col gap-3">
                  {timelineItems.map((stage, index) => (
                    <TimelineStageItem
                      key={`${stage.id}:${stage.date.getTime()}:${stage.label}:${stage.notes ?? ""}`}
                      stage={stage}
                      isLast={index === timelineItems.length - 1}
                    />
                  ))}
                </ol>
              )}
            </DetailSection>

            <DetailSection title="Notas">
              <NotesEditor
                key={`${application.id}:${application.updatedAt.getTime()}:${application.notes ?? ""}`}
                applicationId={application.id}
                initialNotes={application.notes}
              />
            </DetailSection>

            <DetailSection title="Currículo">
              <UsedResumeSection
                applicationId={application.id}
                status={usedResumeStatus}
                originalFilename={application.usedResumeOriginalFilename}
                savedGeneratedResumePath={application.generatedResumePath}
              />
            </DetailSection>

            <DescriptionEditor
              key={`${application.id}:${application.updatedAt.getTime()}:${application.description ?? ""}`}
              applicationId={application.id}
              initialDescription={application.description}
            />
          </div>

          <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
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
              updatedAt={application.updatedAt}
            />
          </aside>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/50 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        {application.sourceUrl ? (
          <a
            href={application.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "flex-1 rounded-xl sm:flex-none",
            )}
          >
            Abrir vaga original
            <ExternalLink data-icon="inline-end" />
          </a>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onClose}
          className={cn("rounded-xl sm:ml-auto", application.sourceUrl && "max-sm:hidden", !application.sourceUrl && "flex-1 sm:flex-none")}
        >
          Fechar
        </Button>
      </div>
    </>
  );
}

function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
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
      aria-label="Etapa atual"
      className={cn("rounded-2xl px-4 py-4 sm:px-5", health.containerClassName)}
    >
      {currentStage ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Etapa atual</p>
            <h3 className="mt-0.5 text-lg leading-snug font-semibold text-balance text-foreground">
              {currentStage.label}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Desde {formatLongDate(currentStage.date)}
            </p>
          </div>
          <div className={cn("shrink-0 rounded-xl px-3 py-2 text-right", health.metricClassName)}>
            <p className="text-xs text-muted-foreground">Na etapa</p>
            <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", health.valueClassName)}>
              {formatDuration(currentStage.date, new Date())}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-base font-semibold text-foreground">Ainda sem etapa definida</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Registre o primeiro marco real deste processo para começar a medir o tempo.
          </p>
        </div>
      )}
      {currentStage ? (
        <p className={cn("mt-3 text-sm font-medium text-pretty", health.messageClassName)}>
          {health.message}
        </p>
      ) : null}
    </section>
  );
}

function StageComposer({
  applicationId,
  onDone,
}: {
  applicationId: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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
      onDone();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("grid animate-in gap-3 p-4 fade-in-0 slide-in-from-top-1 duration-200", panelClassName)}
    >
      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Etapa
        <Input
          autoFocus
          value={fields.label}
          onChange={(event) =>
            setFields((current) => ({ ...current, label: event.target.value }))
          }
          placeholder="Ex.: Triagem RH"
          className={controlClassName}
        />
      </label>
      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Data
        <Input
          type="date"
          value={fields.date}
          onChange={(event) =>
            setFields((current) => ({ ...current, date: event.target.value }))
          }
          className={controlClassName}
        />
      </label>
      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Notas
        <Textarea
          value={fields.notes}
          onChange={(event) =>
            setFields((current) => ({ ...current, notes: event.target.value }))
          }
          placeholder="Como foi, próximos passos…"
          className={textareaClassName}
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} className="rounded-xl">
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending} className="rounded-xl">
          {isPending ? "Salvando…" : "Salvar etapa"}
        </Button>
      </div>
    </form>
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

  async function postResumeForm(formData: FormData) {
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

  function runResumeMutation(formData: FormData, fallbackError: string, onFinally?: () => void) {
    setError(null);

    startTransition(async () => {
      try {
        await postResumeForm(formData);
        router.refresh();
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : fallbackError);
      } finally {
        onFinally?.();
      }
    });
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    runResumeMutation(formData, "Falha ao salvar o currículo desta candidatura.", () => {
      event.target.value = "";
    });
  }

  function handleMarkAs(mode: "empty" | "unknown") {
    const formData = new FormData();
    formData.set("mode", mode);
    runResumeMutation(formData, "Falha ao atualizar o status do currículo desta candidatura.");
  }

  const generatedPdfHref = `/api/applications/${applicationId}/generated-resume`;

  if (status === "empty") {
    return (
      <div className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between", panelClassName)}>
        <div className="flex items-center gap-2 text-amber-100">
          <FileX2 aria-hidden className="size-4 shrink-0" />
          <p className="text-sm font-medium">Candidatura feita sem currículo</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => handleMarkAs("unknown")}
          className="self-start rounded-lg text-muted-foreground sm:self-auto"
        >
          {isPending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
          Desfazer
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden", panelClassName)}>
      {status === "uploaded" ? (
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 text-sm text-muted-foreground">
          <FileUp aria-hidden className="size-4 shrink-0" />
          <span className="truncate">
            PDF enviado{originalFilename ? `: ${originalFilename}` : ""}
          </span>
        </div>
      ) : null}

      {status !== "uploaded" && resumePhase !== "done" ? (
        <div className="flex flex-col gap-3 border-b border-border/50 p-4">
          <p className="text-sm leading-6 text-pretty text-muted-foreground">
            Salve o PDF enviado nesta vaga ou marque que a candidatura foi feita sem currículo.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cn(
                buttonVariants({ variant: "brand", size: "sm" }),
                "cursor-pointer rounded-lg has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50",
              )}
            >
              <FileUp data-icon="inline-start" />
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
              onClick={() => handleMarkAs("empty")}
              className="rounded-lg"
            >
              <CircleSlash data-icon="inline-start" />
              Sem currículo
            </Button>
            {isPending ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Atualizando…
              </span>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Currículo personalizado por IA</p>
          <p className="mt-1 text-sm leading-6 text-pretty text-muted-foreground">
            Seleciona e reescreve os bullets e habilidades mais relevantes para esta vaga.
          </p>
        </div>
        {resumePhase === "error" && resumeError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {resumeError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {resumePhase === "done" && pdfPath ? (
            <>
              <a
                href={generatedPdfHref}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-lg")}
              >
                Abrir PDF
                <ExternalLink data-icon="inline-end" />
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateResume}
                disabled={isGenerating}
                className="rounded-lg text-muted-foreground"
              >
                {isGenerating ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
                Gerar novamente
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleGenerateResume}
              disabled={isGenerating}
              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isGenerating ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              {isGenerating
                ? "Gerando…"
                : resumePhase === "error"
                  ? "Tentar novamente"
                  : "Gerar currículo"}
            </Button>
          )}
        </div>
      </div>

      {/* Inline PDF preview is unreliable on phones; they get "Abrir PDF". */}
      {resumePhase === "done" && pdfPath ? (
        <div className="hidden border-t border-border/50 sm:block">
          <iframe
            src={generatedPdfHref}
            className="w-full"
            style={{ height: "min(780px, 65vh)" }}
            title="Prévia do currículo gerado"
          />
        </div>
      ) : null}
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
    <li className="relative pl-7">
      {!isLast ? (
        <span
          aria-hidden
          className="absolute top-6 bottom-[-0.75rem] left-[0.4375rem] w-px bg-emerald-400/25"
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          "absolute top-4 left-0 size-3.5 rounded-full border-2",
          stage.isCurrent
            ? "border-amber-200/80 bg-amber-300"
            : "border-emerald-300/40 bg-emerald-400/70",
        )}
      />

      <div
        className={cn(
          "rounded-2xl border px-4 py-3",
          stage.isCurrent
            ? "border-amber-300/25 bg-amber-300/[0.07]"
            : "border-border/50 bg-background/30",
        )}
      >
        {!isEditing ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm leading-snug font-semibold break-words text-foreground">
                  {stage.label}
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatLongDate(stage.date)}
                  <span aria-hidden> · </span>
                  <span className={cn(stage.isCurrent ? "text-amber-100" : "text-foreground/75")}>
                    {stage.durationLabel}
                  </span>
                </p>
              </div>

              <div className="-mr-2 -mt-1 flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsEditing(true)}
                  aria-label={`Editar etapa ${stage.label}`}
                  className="rounded-lg text-muted-foreground"
                >
                  <PencilLine />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDelete}
                  disabled={isPending}
                  aria-label={`Excluir etapa ${stage.label}`}
                  className="rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            {stage.notes ? (
              <p className="mt-2 text-sm leading-6 break-words whitespace-pre-line text-foreground/80">
                {stage.notes}
              </p>
            ) : null}

            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
        ) : (
          <form onSubmit={handleSave} className="grid gap-3 py-1">
            <Input
              aria-label="Nome da etapa"
              value={fields.label}
              onChange={(event) =>
                setFields((current) => ({ ...current, label: event.target.value }))
              }
              className={controlClassName}
            />
            <Input
              aria-label="Data da etapa"
              type="date"
              value={fields.date}
              onChange={(event) =>
                setFields((current) => ({ ...current, date: event.target.value }))
              }
              className={controlClassName}
            />
            <Textarea
              aria-label="Notas da etapa"
              value={fields.notes}
              onChange={(event) =>
                setFields((current) => ({ ...current, notes: event.target.value }))
              }
              className={textareaClassName}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </li>
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
    } catch {
      setError("Erro ao formatar a descrição.");
    } finally {
      setIsFormatting(false);
    }
  }

  return (
    <DetailSection
      title="Descrição da vaga"
      action={
        !isEditing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(true);
              setDescription(initialDescription ?? "");
            }}
            className="rounded-lg text-muted-foreground"
          >
            <PencilLine data-icon="inline-start" />
            Editar
          </Button>
        ) : null
      }
    >
      {!isEditing ? (
        initialDescription ? (
          <JobMarkdown
            content={initialDescription}
            className="min-w-0 break-words sm:rounded-xl sm:border sm:border-border/50 sm:bg-muted/15 sm:p-5"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma descrição salva.</p>
        )
      ) : (
        <form onSubmit={handleSave} className="grid gap-3">
          <Textarea
            aria-label="Descrição da vaga em markdown"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descrição da vaga…"
            className={cn(textareaClassName, "min-h-48")}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleFormat}
              disabled={isFormatting || !description.trim()}
              className="rounded-xl"
            >
              {isFormatting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              {isFormatting ? "Formatando…" : "Formatar com IA"}
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
              <Button type="submit" disabled={isPending || !hasChanges} className="rounded-xl">
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </DetailSection>
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
        aria-label="Notas da candidatura"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Resposta da recrutadora, alinhamento salarial, próximos passos…"
        className={cn(textareaClassName, "min-h-28")}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {hasChanges || isPending ? (
        <div className="flex animate-in items-center justify-end gap-2 fade-in-0 duration-150">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setNotes(initialNotes ?? "")}
            disabled={isPending}
            className="rounded-xl"
          >
            Descartar
          </Button>
          <Button type="submit" disabled={isPending} className="rounded-xl">
            {isPending ? "Salvando…" : "Salvar notas"}
          </Button>
        </div>
      ) : null}
    </form>
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
  updatedAt,
}: {
  applicationId: number;
  initialSourceName: string | null;
  initialWorkModel: string | null;
  initialSeniority: string | null;
  initialIsReferral: boolean;
  appId: string;
  company: string | null;
  createdAt: Date;
  updatedAt: Date;
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

  const staticRows = [
    { label: "Candidatura", value: appId },
    { label: "Empresa", value: company ?? "Não informada" },
    { label: "Registrada em", value: formatLongDate(createdAt) },
    { label: "Atualizada em", value: formatLongDate(updatedAt) },
  ];

  const contextRows = [
    { label: "Origem", value: getSourceNameLabel(initialSourceName) ?? "Não informada" },
    { label: "Modelo", value: getWorkModelLabel(initialWorkModel) ?? "Não informado" },
    { label: "Senioridade", value: getSeniorityLabel(initialSeniority) ?? "Não informada" },
    { label: "Indicação", value: initialIsReferral ? "Sim" : "Não" },
  ];

  return (
    <DetailSection
      title="Contexto da vaga"
      action={
        !isEditing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="rounded-lg text-muted-foreground"
          >
            <PencilLine data-icon="inline-start" />
            Editar
          </Button>
        ) : null
      }
    >
      <dl className="divide-y divide-border/40 rounded-2xl border border-border/60">
        {(isEditing ? staticRows : [...staticRows, ...contextRows]).map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-sm text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium break-words text-foreground/90">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {isEditing ? (
        <div className={cn("grid animate-in gap-3 p-4 fade-in-0 duration-150", panelClassName)}>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Origem
            <select
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              className={controlClassName}
            >
              <option value="">Não informada</option>
              {sourceNameOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Modelo de trabalho
            <select
              value={workModel}
              onChange={(event) => setWorkModel(event.target.value)}
              className={controlClassName}
            >
              <option value="">Não informado</option>
              {workModelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Senioridade
            <select
              value={seniority}
              onChange={(event) => setSeniority(event.target.value)}
              className={controlClassName}
            >
              <option value="">Não informada</option>
              {seniorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-foreground/90">
            <input
              type="checkbox"
              checked={isReferral}
              onChange={(event) => setIsReferral(event.target.checked)}
              className="size-5 rounded accent-brand"
            />
            Candidatura por indicação
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
              disabled={isSaving}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving} className="rounded-xl">
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : null}
    </DetailSection>
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
      containerClassName: "border border-dashed border-border/70",
      metricClassName: "border border-border/60 bg-background/40",
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
      containerClassName: "border border-emerald-400/25 bg-emerald-400/10",
      metricClassName: "border border-emerald-400/20 bg-emerald-950/35",
      valueClassName: "text-emerald-100",
      messageClassName: "text-emerald-200",
      message: "Dentro do tempo razoável para esta etapa.",
    };
  }

  if (days <= 30) {
    return {
      containerClassName: "border border-amber-400/25 bg-amber-400/10",
      metricClassName: "border border-amber-400/20 bg-amber-950/35",
      valueClassName: "text-amber-100",
      messageClassName: "text-amber-200",
      message: "Exige atenção. Vale considerar follow-up ou reavaliar o próximo passo.",
    };
  }

  return {
    containerClassName: "border border-rose-400/25 bg-rose-400/10",
    metricClassName: "border border-rose-400/20 bg-rose-950/35",
    valueClassName: "text-rose-100",
    messageClassName: "text-rose-200",
    message: "Parado há bastante tempo. Pode fazer sentido encerrar como rejeitada ou desistência.",
  };
}
