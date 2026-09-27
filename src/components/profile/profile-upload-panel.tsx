"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileUp } from "lucide-react";

import {
  extractProfileDraft,
  type ExtractProfileActionResult,
  type ExtractProfileDraftActionResult,
  saveExtractedProfile,
} from "@/server/actions/profile";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { StatusDot, type StatusTone } from "@/components/ui/status";
import { cn } from "@/lib/utils";

type UploadApiResponse =
  | {
      ok: true;
      rawText: string;
      masterResumePath: string;
      originalFilename: string;
      size: number;
    }
  | {
      ok: false;
      error: string;
    };

type StepStatus = "pending" | "active" | "done" | "error";

const IDLE_STATUS = {
  tone: "idle" as const,
  title: "Upload e extração",
  detail:
    "Envie um PDF e o app salvará o currículo master localmente antes de chamar a OpenAI para estruturar seu perfil.",
};

const stepTone: Record<StepStatus, StatusTone> = {
  pending: "muted",
  active: "active",
  done: "positive",
  error: "negative",
};

const stepLabelClass: Record<StepStatus, string> = {
  pending: "text-muted-foreground",
  active: "text-foreground",
  done: "text-foreground",
  error: "text-negative",
};

const stepStatusLabel: Record<StepStatus, string> = {
  pending: "pendente",
  active: "em andamento",
  done: "concluída",
  error: "falhou",
};

type ProfileUploadPanelProps = {
  /**
   * With no profile yet the upload is the page's only action, so the trigger
   * becomes the primary button with first-upload copy.
   */
  hasProfile?: boolean;
};

export function ProfileUploadPanel({ hasProfile = true }: ProfileUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, setStatus] = useState<{
    tone: "idle" | "success" | "error";
    title: string;
    detail: string;
  }>(IDLE_STATUS);
  const [steps, setSteps] = useState<Array<{
    key: "text" | "model" | "database";
    label: string;
    status: "pending" | "active" | "done" | "error";
    startedAt: number | null;
    finishedAt: number | null;
  }>>([
    {
      key: "text",
      label: "Extraindo texto do PDF",
      status: "pending",
      startedAt: null,
      finishedAt: null,
    },
    {
      key: "model",
      label: "Processando com OpenAI",
      status: "pending",
      startedAt: null,
      finishedAt: null,
    },
    {
      key: "database",
      label: "Salvando no banco de dados",
      status: "pending",
      startedAt: null,
      finishedAt: null,
    },
  ]);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isSubmitting]);

  function updateStep(
    key: "text" | "model" | "database",
    status: "pending" | "active" | "done" | "error",
    ts: number,
  ) {
    setSteps((current) =>
      current.map((step) => {
        if (step.key !== key) {
          return step;
        }

        if (status === "active") {
          return {
            ...step,
            status,
            startedAt: step.startedAt ?? ts,
            finishedAt: null,
          };
        }

        if ((status === "done" || status === "error") && step.startedAt) {
          return {
            ...step,
            status,
            finishedAt: ts,
          };
        }

        return { ...step, status };
      }),
    );
  }

  function resetSteps() {
    setSteps([
      {
        key: "text",
        label: "Extraindo texto do PDF",
        status: "pending",
        startedAt: null,
        finishedAt: null,
      },
      {
        key: "model",
        label: "Processando com OpenAI",
        status: "pending",
        startedAt: null,
        finishedAt: null,
      },
      {
        key: "database",
        label: "Salvando no banco de dados",
        status: "pending",
        startedAt: null,
        finishedAt: null,
      },
    ]);
  }

  async function handleSubmit(formData: FormData) {
    const startTs = Date.now();
    setIsSubmitting(true);
    setNowMs(startTs);
    resetSteps();
    updateStep("text", "active", startTs);
    setStatus({
      tone: "idle",
      title: "Enviando o PDF",
      detail:
        "Salvando o currículo master em uploads/resumes/master e extraindo o texto bruto.",
    });

    let uploadPayload: UploadApiResponse;

    try {
      const response = await fetch("/api/profile/upload", {
        method: "POST",
        body: formData,
      });

      uploadPayload = (await response.json()) as UploadApiResponse;
    } catch (error) {
      setStatus({
        tone: "error",
        title: "Falha no upload",
        detail:
          error instanceof Error
            ? error.message
            : "A requisição de upload falhou por um motivo desconhecido.",
      });
      updateStep("text", "error", Date.now());
      setIsSubmitting(false);
      return;
    }

    if (!uploadPayload.ok) {
      setStatus({
        tone: "error",
        title: "Falha no upload",
        detail: uploadPayload.error,
      });
      updateStep("text", "error", Date.now());
      setIsSubmitting(false);
      return;
    }

    const afterUploadTs = Date.now();
    updateStep("text", "done", afterUploadTs);
    updateStep("model", "active", afterUploadTs);
    setStatus({
      tone: "idle",
      title: "Executando extração com OpenAI",
      detail:
        "O texto do PDF foi extraído. Agora o perfil está sendo estruturado pela OpenAI.",
    });

    try {
      const extraction: ExtractProfileDraftActionResult = await extractProfileDraft({
        rawText: uploadPayload.rawText,
        masterResumePath: uploadPayload.masterResumePath,
      });

      if (!extraction.ok) {
        setStatus({
          tone: "error",
          title: "Falha na extração",
          detail: extraction.error,
        });
        updateStep("model", "error", Date.now());
        setIsSubmitting(false);
        return;
      }

      const afterExtractionTs = Date.now();
      updateStep("model", "done", afterExtractionTs);
      updateStep("database", "active", afterExtractionTs);
      setStatus({
        tone: "idle",
        title: "Salvando o perfil",
        detail:
          "A extração terminou. Agora o perfil estruturado está sendo persistido no banco local.",
      });

      const result: ExtractProfileActionResult = await saveExtractedProfile({
        extractedProfile: extraction.extractedProfile,
        masterResumePath: uploadPayload.masterResumePath,
      });

      if (!result.ok) {
        setStatus({
          tone: "error",
          title: "Falha ao salvar",
          detail: result.error,
        });
        updateStep("database", "error", Date.now());
        setIsSubmitting(false);
        return;
      }

      updateStep("database", "done", Date.now());
      setStatus({
        tone: "success",
        title: "Perfil atualizado",
        detail: `${uploadPayload.originalFilename} foi salvo localmente e o perfil extraído agora tem ${result.summary.experiences} experiências, ${result.summary.skills} habilidades, ${result.summary.projects} projetos e ${result.summary.education} registros de formação.`,
      });

      fileInputRef.current?.form?.reset();
      router.refresh();
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !isSubmitting) {
      resetSteps();
      setNowMs(Date.now());
      setStatus(IDLE_STATUS);
    }
    setOpen(nextOpen);
  }

  const isLoading = isSubmitting;
  // The resting status repeats the dialog description; only stage updates show.
  const showStatus = status !== IDLE_STATUS;
  const statusTone: StatusTone =
    status.tone === "error"
      ? "negative"
      : status.tone === "success"
        ? "positive"
        : isSubmitting
          ? "active"
          : "neutral";

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={<Button variant={hasProfile ? "outline" : "default"} />}
      >
        <FileUp data-icon="inline-start" />
        {hasProfile ? (
          <>
            <span className="sm:hidden">Currículo</span>
            <span className="hidden sm:inline">Atualizar currículo</span>
          </>
        ) : (
          "Enviar currículo"
        )}
      </DialogTrigger>
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-h-[90vh] sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-1.5 border-b border-border px-4 pt-5 pr-14 pb-4 sm:pt-6 sm:pb-5 sm:pl-6">
          <DialogTitle>Upload do currículo master</DialogTitle>
          <DialogDescription className="text-[13px] leading-5">
            Envie um PDF para salvar o currículo original em disco, extrair o
            texto no servidor e atualizar o perfil estruturado.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(new FormData(e.currentTarget));
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <ResumeDropzone inputRef={fileInputRef} />

            <section className="mt-5 border-t border-border pt-5">
              <h3 className="text-[13px] font-medium text-muted-foreground">
                Etapas do processamento
              </h3>
              <ol className="mt-3 flex flex-col gap-2.5">
                {steps.map((step, index) => (
                  <li className="flex min-w-0 items-center gap-3 text-sm" key={step.key}>
                    <StatusDot
                      pulse={step.status === "active"}
                      tone={stepTone[step.status]}
                    />
                    <span className="w-3 shrink-0 font-data text-xs text-subtle-foreground">
                      {index + 1}
                    </span>
                    <span className={cn("min-w-0 truncate", stepLabelClass[step.status])}>
                      {step.label}
                      <span className="sr-only">: {stepStatusLabel[step.status]}</span>
                    </span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 font-data text-xs",
                        step.status === "active"
                          ? "text-muted-foreground"
                          : "text-subtle-foreground",
                      )}
                    >
                      {formatElapsed(getStepElapsedMs(step, nowMs))}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Live region stays mounted so stage changes are announced. */}
            <div aria-live="polite">
              {showStatus ? (
                <Notice
                  className="mt-5 border-t border-border pt-5"
                  tone={statusTone}
                >
                  <p
                    className={cn(
                      "font-medium text-foreground",
                      status.tone === "error" && "text-negative",
                    )}
                  >
                    {status.title}
                  </p>
                  <p className="mt-0.5">{status.detail}</p>
                </Notice>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
            <Button
              className="flex-1 sm:flex-none"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Extraindo…" : "Enviar e extrair"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Drop target over a native file input: the input covers the whole zone, so
 * clicking, keyboard activation and dropping a file all go through it and the
 * form keeps reading the file from `name="file"`. State here is visual only.
 */
function ResumeDropzone({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const descriptionId = useId();
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const Icon = selectedFile ? FileText : FileUp;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-7 text-center transition-[background-color,border-color,box-shadow] duration-150 hover:bg-surface has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/25",
        isDragging && "border-foreground bg-surface",
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </div>

      <div className="flex max-w-full min-w-0 flex-col gap-0.5" id={descriptionId}>
        {selectedFile ? (
          <>
            <p className="truncate font-data text-sm text-foreground">
              {selectedFile.name}
            </p>
            <p className="font-data text-xs text-subtle-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
          </>
        ) : (
          <>
            {/* Touch screens can't drag files in, so they get picker copy. */}
            <p className="text-sm font-medium text-foreground">
              <span className="pointer-coarse:hidden">
                {isDragging ? "Solte o arquivo aqui" : "Arraste o PDF para cá"}
              </span>
              <span className="hidden pointer-coarse:inline">
                Selecione o currículo em PDF
              </span>
            </p>
            <p className="text-[13px] text-muted-foreground">
              <span className="pointer-coarse:hidden">
                ou selecione um arquivo do computador.{" "}
              </span>
              Apenas PDF.
            </p>
          </>
        )}
      </div>

      <span
        aria-hidden
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {selectedFile ? "Trocar arquivo" : "Selecionar arquivo"}
      </span>

      <input
        ref={inputRef}
        accept="application/pdf,.pdf"
        aria-describedby={descriptionId}
        aria-label="Currículo em PDF"
        className="absolute inset-0 size-full cursor-pointer rounded-xl opacity-0"
        name="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setSelectedFile(file ? { name: file.name, size: file.size } : null);
        }}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDrop={() => setIsDragging(false)}
        required
        type="file"
      />
    </div>
  );
}

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const format = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

  if (bytes < 1024 * 1024) {
    return `${format.format(bytes / 1024)} KB`;
  }

  return `${format.format(bytes / (1024 * 1024))} MB`;
}

function getStepElapsedMs(
  step: {
    startedAt: number | null;
    finishedAt: number | null;
  },
  nowMs: number,
) {
  if (!step.startedAt) {
    return 0;
  }

  return (step.finishedAt ?? nowMs) - step.startedAt;
}
