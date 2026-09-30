"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleSlash,
  ExternalLink,
  FileUp,
  Loader2,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { ApplicationStatusSelect } from "@/components/applications/application-status-select";
import { JobMarkdown } from "@/components/applications/job-markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusDot, type StatusTone } from "@/components/ui/status";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
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

type DefinitionRow = {
  label: string;
  value: string | null;
  /** Shown in subtle text when there is no value. */
  fallback?: string;
  /** Ids and dates are set in the data face. */
  isData?: boolean;
};

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
      <DialogHeader className="shrink-0 gap-3 border-b border-border px-4 pt-5 pr-14 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {onStatusChange ? (
            <ApplicationStatusSelect value={application.status} onChange={onStatusChange} />
          ) : (
            <ApplicationStatusBadge status={application.status} />
          )}
          {application.isReferral ? (
            <span className="text-xs text-muted-foreground">Indicação</span>
          ) : null}
        </div>
        <div className="min-w-0">
          <DialogTitle className="text-lg leading-snug text-balance sm:text-xl">
            {application.jobTitle}
          </DialogTitle>
          <DialogDescription className="mt-1 truncate text-sm">
            {application.company ?? "Empresa não informada"}
          </DialogDescription>
        </div>
      </DialogHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
          <div className="flex min-w-0 flex-col gap-6">
            <CurrentStageSummary currentStage={currentStage} />

            <DetailSection
              title="Etapas"
              count={orderedStages.length > 0 ? orderedStages.length : undefined}
              className="border-t border-border pt-5"
              action={
                !isComposingStage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsComposingStage(true)}
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
                  className={cn(timelineItems.length > 0 && "border-b border-border pb-5")}
                />
              ) : null}

              {timelineItems.length === 0 ? (
                !isComposingStage ? (
                  <p className="text-[13px] leading-5 text-pretty text-muted-foreground">
                    Registre triagem, teste técnico ou qualquer etapa real para acompanhar o tempo entre eventos.
                  </p>
                ) : null
              ) : (
                <ol className={cn("flex flex-col", isComposingStage && "pt-2")}>
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

            <DetailSection title="Notas" className="border-t border-border pt-5">
              <NotesEditor
                key={`${application.id}:${application.updatedAt.getTime()}:${application.notes ?? ""}`}
                applicationId={application.id}
                initialNotes={application.notes}
              />
            </DetailSection>

            <DetailSection title="Currículo" className="border-t border-border pt-5">
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
              className="border-t border-border pt-5"
            />
          </div>

          <aside className="min-w-0 border-t border-border pt-5 lg:sticky lg:top-0 lg:self-start lg:border-t-0 lg:pt-0">
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

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
        {application.sourceUrl ? (
          <a
            href={application.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "flex-1 sm:flex-none")}
          >
            Abrir vaga original
            <ExternalLink data-icon="inline-end" />
          </a>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className={cn(
            "sm:ml-auto",
            application.sourceUrl ? "max-sm:hidden" : "flex-1 sm:flex-none",
          )}
        >
          Fechar
        </Button>
      </div>
    </>
  );
}

function DetailSection({
  title,
  count,
  action,
  className,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h3 className="flex items-baseline gap-2 text-sm font-medium text-foreground">
          {title}
          {count !== undefined ? (
            <span className="font-data text-xs text-subtle-foreground">{count}</span>
          ) : null}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label stacked over its control; the label wraps the control, so no ids needed. */
function LabeledControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[13px] leading-5 font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}


function CurrentStageSummary({
  currentStage,
}: {
  currentStage: ApplicationStageData | null;
}) {
  if (!currentStage) {
    return (
      <section aria-label="Etapa atual" className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-foreground">Ainda sem etapa definida</h3>
        <p className="text-[13px] leading-5 text-pretty text-muted-foreground">
          Registre o primeiro marco real deste processo para começar a medir o tempo.
        </p>
      </section>
    );
  }

  const health = getStageHealth(currentStage.date);

  return (
    <section aria-label="Etapa atual" className="flex flex-col gap-3">
      <dl className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <dt className="text-xs text-subtle-foreground">Etapa atual</dt>
          <dd className="mt-1 text-base leading-snug font-semibold text-balance break-words text-foreground">
            {currentStage.label}
          </dd>
          <dd className="mt-1 text-[13px] text-muted-foreground">
            Desde{" "}
            <time dateTime={currentStage.date.toISOString()} className="font-data">
              {formatLongDate(currentStage.date)}
            </time>
          </dd>
        </div>
        <div className="shrink-0 text-right">
          <dt className="text-xs text-subtle-foreground">Na etapa</dt>
          <dd className="mt-1 font-data text-base leading-snug font-medium text-foreground">
            {formatDuration(currentStage.date, new Date())}
          </dd>
        </div>
      </dl>
      <Notice tone={health.tone}>{health.message}</Notice>
    </section>
  );
}

function StageComposer({
  applicationId,
  onDone,
  className,
}: {
  applicationId: number;
  onDone: () => void;
  className?: string;
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
      className={cn(
        "grid animate-in gap-4 fade-in-0 slide-in-from-top-1 duration-200",
        className,
      )}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <LabeledControl label="Etapa">
          <Input
            autoFocus
            value={fields.label}
            onChange={(event) =>
              setFields((current) => ({ ...current, label: event.target.value }))
            }
            placeholder="Ex.: Triagem RH"
          />
        </LabeledControl>
        <LabeledControl label="Data">
          <Input
            type="date"
            value={fields.date}
            onChange={(event) =>
              setFields((current) => ({ ...current, date: event.target.value }))
            }
            className="font-data"
          />
        </LabeledControl>
      </div>
      <LabeledControl label="Notas">
        <Textarea
          value={fields.notes}
          onChange={(event) =>
            setFields((current) => ({ ...current, notes: event.target.value }))
          }
          placeholder="Como foi, próximos passos…"
        />
      </LabeledControl>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="outline" disabled={isPending}>
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Notice tone="muted">Candidatura feita sem currículo.</Notice>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => handleMarkAs("unknown")}
          >
            {isPending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            Desfazer
          </Button>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    );
  }

  const hasGeneratedPdf = resumePhase === "done" && Boolean(pdfPath);
  // Uploaded file line or the upload prompt sits above the AI block.
  const hasUploadBlock = status === "uploaded" || resumePhase !== "done";

  return (
    <div className="flex flex-col gap-4">
      {status === "uploaded" ? (
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <FileUp aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
          <span className="truncate">
            PDF enviado
            {originalFilename ? (
              <>
                : <span className="text-foreground">{originalFilename}</span>
              </>
            ) : null}
          </span>
        </p>
      ) : resumePhase !== "done" ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-5 text-pretty text-muted-foreground">
            Salve o PDF enviado nesta vaga ou marque que a candidatura foi feita sem currículo.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer has-[:disabled]:pointer-events-none has-[:disabled]:opacity-40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
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
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => handleMarkAs("empty")}
            >
              <CircleSlash data-icon="inline-start" />
              Sem currículo
            </Button>
            {isPending ? (
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                Atualizando…
              </span>
            ) : null}
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
        </div>
      ) : null}

      <div className={cn("flex flex-col gap-3", hasUploadBlock && "border-t border-border pt-4")}>
        <div>
          <h4 className="text-[13px] font-medium text-foreground">
            Currículo personalizado por IA
          </h4>
          <p className="mt-1 text-[13px] leading-5 text-pretty text-muted-foreground">
            Seleciona e reescreve os bullets e habilidades mais relevantes para esta vaga.
          </p>
        </div>
        {resumePhase === "error" && resumeError ? (
          <Notice tone="negative">{resumeError}</Notice>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {hasGeneratedPdf ? (
            <>
              <a
                href={generatedPdfHref}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
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
              >
                {isGenerating ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
                Gerar novamente
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateResume}
              disabled={isGenerating}
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

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div>
          <h4 className="text-[13px] font-medium text-foreground">Candidatura assistida</h4>
          <p className="mt-1 text-[13px] leading-5 text-pretty text-muted-foreground">
            Currículo em inglês, cover letter e respostas do formulário, prontos para copiar. O app nunca envia nada
            por você.
          </p>
        </div>
        <div>
          <Link
            href={`/applications/${applicationId}/kit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Preparar candidatura
          </Link>
        </div>
      </div>

      {/* Inline PDF preview is unreliable on phones; they get "Abrir PDF". */}
      {hasGeneratedPdf ? (
        <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
          <iframe
            src={generatedPdfHref}
            className="block w-full"
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
    <li className="relative pb-5 pl-6 last:pb-0">
      {/* Hairline rail between dots; the current (latest) stage gets the bright dot. */}
      {!isLast ? (
        <span
          aria-hidden
          className="absolute top-[17px] -bottom-[3px] left-[2.5px] w-px bg-border"
        />
      ) : null}
      <StatusDot
        tone={stage.isCurrent ? "active" : "neutral"}
        className="absolute top-[7px] left-0"
      />

      {!isEditing ? (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm leading-5 font-medium break-words text-foreground">
                {stage.label}
              </h4>
              <p className="mt-0.5 text-xs text-subtle-foreground">
                <time dateTime={stage.date.toISOString()} className="font-data">
                  {formatLongDate(stage.date)}
                </time>
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                <span
                  className={cn(
                    "font-data",
                    stage.isCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.durationLabel}
                </span>
              </p>
            </div>

            <div className="-mt-1 -mr-1.5 flex shrink-0 items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsEditing(true)}
                aria-label={`Editar etapa ${stage.label}`}
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
                className="hover:bg-destructive/12 hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          {stage.notes ? (
            <p className="mt-1.5 max-w-[68ch] text-sm leading-6 break-words whitespace-pre-line text-muted-foreground">
              {stage.notes}
            </p>
          ) : null}

          {error ? <FieldError className="mt-2">{error}</FieldError> : null}
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <Input
              aria-label="Nome da etapa"
              value={fields.label}
              onChange={(event) =>
                setFields((current) => ({ ...current, label: event.target.value }))
              }
            />
            <Input
              aria-label="Data da etapa"
              type="date"
              value={fields.date}
              onChange={(event) =>
                setFields((current) => ({ ...current, date: event.target.value }))
              }
              className="font-data"
            />
          </div>
          <Textarea
            aria-label="Notas da etapa"
            value={fields.notes}
            onChange={(event) =>
              setFields((current) => ({ ...current, notes: event.target.value }))
            }
          />
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setError(null);
                setFields(createStageFormFromStage(stage));
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="outline" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function DescriptionEditor({
  applicationId,
  initialDescription,
  className,
}: {
  applicationId: number;
  initialDescription: string | null;
  className?: string;
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
      className={className}
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
            className="max-w-[68ch] min-w-0 break-words"
          />
        ) : (
          <p className="text-sm text-subtle-foreground">Nenhuma descrição salva.</p>
        )
      ) : (
        <form onSubmit={handleSave} className="grid gap-3">
          <Textarea
            aria-label="Descrição da vaga em markdown"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descrição da vaga…"
            className="min-h-48"
          />
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleFormat}
              disabled={isFormatting || !description.trim()}
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
              >
                Cancelar
              </Button>
              <Button type="submit" variant="outline" disabled={isPending || !hasChanges}>
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
        className="min-h-24"
      />
      {error ? <FieldError>{error}</FieldError> : null}
      {hasChanges || isPending ? (
        <div className="flex animate-in items-center justify-end gap-2 fade-in-0 duration-150">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setNotes(initialNotes ?? "")}
            disabled={isPending}
          >
            Descartar
          </Button>
          <Button type="submit" variant="outline" disabled={isPending}>
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

  const staticRows: DefinitionRow[] = [
    { label: "Candidatura", value: appId, isData: true },
    { label: "Empresa", value: company, fallback: "Não informada" },
    { label: "Registrada em", value: formatLongDate(createdAt), isData: true },
    { label: "Atualizada em", value: formatLongDate(updatedAt), isData: true },
  ];

  const contextRows: DefinitionRow[] = [
    { label: "Origem", value: getSourceNameLabel(initialSourceName), fallback: "Não informada" },
    { label: "Modelo", value: getWorkModelLabel(initialWorkModel), fallback: "Não informado" },
    { label: "Senioridade", value: getSeniorityLabel(initialSeniority), fallback: "Não informada" },
    { label: "Indicação", value: initialIsReferral ? "Sim" : "Não" },
  ];

  return (
    <DetailSection
      title="Contexto da vaga"
      action={
        !isEditing ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleEdit}>
            <PencilLine data-icon="inline-start" />
            Editar
          </Button>
        ) : null
      }
    >
      {/* Stacked grid while the aside is full width; label/value rows in the
          narrow desktop column. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-1 lg:gap-y-0 lg:divide-y lg:divide-border">
        {(isEditing ? staticRows : [...staticRows, ...contextRows]).map((row) => (
          <div
            key={row.label}
            className="min-w-0 lg:flex lg:items-baseline lg:justify-between lg:gap-4 lg:py-2.5 lg:first:pt-0 lg:last:pb-0"
          >
            <dt className="text-xs text-subtle-foreground lg:shrink-0">{row.label}</dt>
            <dd
              className={cn(
                "mt-1 text-sm break-words text-foreground lg:mt-0 lg:min-w-0 lg:text-right",
                row.isData && "font-data text-[13px]",
                !row.value && "text-subtle-foreground",
              )}
            >
              {row.value || row.fallback}
            </dd>
          </div>
        ))}
      </dl>

      {isEditing ? (
        <div className="grid animate-in gap-4 border-t border-border pt-4 fade-in-0 duration-150">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <LabeledControl label="Origem">
              <NativeSelect
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
              >
                <option value="">Não informada</option>
                {sourceNameOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </NativeSelect>
            </LabeledControl>

            <LabeledControl label="Modelo de trabalho">
              <NativeSelect
                value={workModel}
                onChange={(event) => setWorkModel(event.target.value)}
              >
                <option value="">Não informado</option>
                {workModelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </NativeSelect>
            </LabeledControl>

            <LabeledControl label="Senioridade">
              <NativeSelect
                value={seniority}
                onChange={(event) => setSeniority(event.target.value)}
              >
                <option value="">Não informada</option>
                {seniorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </NativeSelect>
            </LabeledControl>
          </div>

          <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm text-foreground pointer-coarse:min-h-10">
            <input
              type="checkbox"
              checked={isReferral}
              onChange={(event) => setIsReferral(event.target.checked)}
              className="size-4 shrink-0 cursor-pointer accent-foreground"
            />
            Candidatura por indicação
          </label>

          {error ? <FieldError>{error}</FieldError> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={handleSave} disabled={isSaving}>
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

/** Time in the current stage; the tone lands on the notice dot only. */
function getStageHealth(date: Date): { tone: StatusTone; message: string } {
  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 86_400_000),
  );

  if (days <= 14) {
    return {
      tone: "positive",
      message: "Dentro do tempo razoável para esta etapa.",
    };
  }

  if (days <= 30) {
    return {
      tone: "caution",
      message: "Exige atenção. Vale considerar follow-up ou reavaliar o próximo passo.",
    };
  }

  return {
    tone: "negative",
    message: "Parado há bastante tempo. Pode fazer sentido encerrar como rejeitada ou desistência.",
  };
}
