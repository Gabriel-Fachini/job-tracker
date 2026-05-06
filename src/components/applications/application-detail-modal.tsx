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
  FileX2,
  Hash,
  Layers3,
  PencilLine,
  Plus,
  RadioTower,
  Sparkles,
  Trash2,
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
} from "@/lib/jobs";
import { cn } from "@/lib/utils";
import {
  createApplicationStage,
  deleteApplicationStage,
  updateApplicationNotes,
  updateApplicationStage,
} from "@/server/actions/applications";

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
  notes: string | null;
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
  const metaItems: MetaItem[] = [
    {
      label: "Candidatura",
      value: `APP-${application.id}`,
      icon: Hash,
    },
    {
      label: "Empresa",
      value: application.company ?? "Não informada",
      icon: Building2,
    },
    {
      label: "Origem",
      value: getSourceNameLabel(application.sourceName) ?? "Não informada",
      icon: RadioTower,
    },
    {
      label: "Modelo",
      value: getWorkModelLabel(application.workModel) ?? "Não informado",
      icon: Layers3,
    },
    {
      label: "Senioridade",
      value: getSeniorityLabel(application.seniority) ?? "Não informada",
      icon: Sparkles,
    },
    {
      label: "Registrada em",
      value: formatLongDate(application.createdAt),
      icon: CalendarDays,
    },
  ];

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
                  <SectionEyebrow>Currículo usado</SectionEyebrow>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    PDF efetivamente enviado nesta vaga
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <UsedResumeSection
                    applicationId={application.id}
                    status={usedResumeStatus}
                    originalFilename={application.usedResumeOriginalFilename}
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
                  <JobMarkdown
                    content={application.description}
                    className="rounded-xl border border-border/50 bg-muted/15 p-5"
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
                <div className="border-b border-border/40 px-5 py-4">
                  <SectionEyebrow>Metadados</SectionEyebrow>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    Contexto da vaga
                  </h3>
                </div>
                <div className="grid gap-3 px-5 py-5">
                  {metaItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-950/75 p-3"
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
                </div>
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
          className="rounded-2xl border border-zinc-700/70 bg-zinc-950/70 p-4 sm:min-w-[22rem]"
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
}: {
  applicationId: number;
  status: UsedResumeStatus;
  originalFilename: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-700/70 bg-zinc-950/75 p-4">
        {status === "uploaded" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-emerald-200">
                <FileUp className="size-4" />
                <p className="text-sm font-semibold">PDF registrado para esta candidatura</p>
              </div>
              <p className="mt-2 text-sm text-foreground/85">
                {originalFilename ?? "Arquivo salvo localmente"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use este registro para lembrar exatamente qual currículo foi enviado nesta plataforma.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/applications/${applicationId}/resume`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
              >
                Abrir PDF
              </a>
              <label
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "cursor-pointer rounded-xl",
                )}
              >
                Substituir PDF
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
                onClick={handleMarkAsEmpty}
                className="rounded-xl text-muted-foreground"
              >
                <CircleSlash data-icon="inline-start" className="size-3.5" />
                Marcar como sem currículo
              </Button>
            </div>
          </div>
        ) : status === "empty" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-amber-100">
                <FileX2 className="size-4" />
                <p className="text-sm font-semibold">Candidatura registrada sem currículo</p>
              </div>
              <p className="mt-1 text-sm leading-5 text-amber-50/85">
                Plataforma sem envio de PDF, como alguns fluxos da Gupy.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-100">
                Sem currículo
              </span>
              <label
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "cursor-pointer rounded-xl border-amber-300/30 bg-amber-300/6 text-amber-50 hover:bg-amber-300/12",
                )}
              >
                Enviar PDF agora
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={handleFileSelection}
                  disabled={isPending}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-foreground">
                <FileText className="size-4 text-muted-foreground" />
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
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {isPending ? (
        <p className="text-sm text-muted-foreground">Atualizando o registro do currículo...</p>
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
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/75 p-3">
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
