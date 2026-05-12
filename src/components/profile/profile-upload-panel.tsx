"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, FileUp, LoaderCircle } from "lucide-react";

import {
  extractProfileDraft,
  type ExtractProfileActionResult,
  type ExtractProfileDraftActionResult,
  saveExtractedProfile,
} from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

const IDLE_STATUS = {
  tone: "idle" as const,
  title: "Upload e extração",
  detail:
    "Envie um PDF e o app salvará o currículo master localmente antes de chamar a OpenAI para estruturar seu perfil.",
};

export function ProfileUploadPanel() {
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

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button
            className="h-11 w-full rounded-[1rem] border border-emerald-400/20 bg-[rgba(54,117,84,0.12)] text-emerald-100 hover:bg-[rgba(61,129,92,0.18)] sm:w-auto"
            size="lg"
            variant="outline"
          />
        }
      >
        <FileUp data-icon="inline-start" />
        Atualizar currículo
      </DialogTrigger>
      <DialogContent className="h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] p-0 sm:h-auto sm:max-w-2xl">
        <DialogHeader className="gap-1 border-b px-4 py-4">
          <DialogTitle>Upload do currículo master</DialogTitle>
          <DialogDescription>
            Envie um PDF para salvar o currículo original em disco, extrair o
            texto no servidor e atualizar o perfil estruturado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-auto px-4 py-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(new FormData(e.currentTarget));
            }}
          >
            <label className="flex flex-col gap-2 text-base text-foreground">
              <span className="font-medium">Currículo em PDF</span>
              <input
                ref={fileInputRef}
                accept="application/pdf,.pdf"
                className="block w-full rounded-lg border border-dashed border-border bg-background px-5 py-7 text-base text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:border-primary/45"
                name="file"
                required
                type="file"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted-foreground sm:max-w-md">
                Apenas PDF. O fluxo continua local-first e a comparação remota
                permanece fora desta interface.
              </p>
              <Button
                className="border-emerald-400/18 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/16"
                disabled={isLoading}
                type="submit"
                variant="outline"
              >
                {isLoading ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <FileUp data-icon="inline-start" />
                )}
                {isLoading ? "Extraindo..." : "Enviar e extrair"}
              </Button>
            </div>
          </form>

          <div className="rounded-xl border border-border bg-background/60 px-5 py-4">
            <p className="text-sm font-medium text-foreground">
              Etapas do processamento
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {steps.map((step, index) => (
                <div className="flex items-center gap-3 text-sm" key={step.key}>
                  <StepIcon status={step.status} />
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{index + 1}.</span>
                    <span
                      className={
                        step.status === "done"
                          ? "text-foreground"
                          : step.status === "error"
                            ? "text-destructive"
                            : step.status === "active"
                              ? "text-foreground"
                              : "text-muted-foreground"
                      }
                    >
                      {step.label}
                    </span>
                  </div>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {formatElapsed(getStepElapsedMs(step, nowMs))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            aria-live="polite"
            className={`rounded-xl border px-5 py-4 text-base ${
              status.tone === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : status.tone === "success"
                  ? "border-emerald-400/18 bg-emerald-500/10 text-emerald-100"
                  : "border-border bg-muted/35 text-muted-foreground"
            }`}
          >
            <p className="font-medium">{status.title}</p>
            <p className="mt-1 leading-7">{status.detail}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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

function StepIcon({
  status,
}: {
  status: "pending" | "active" | "done" | "error";
}) {
  if (status === "done") {
    return <CheckCircle2 className="text-primary" />;
  }

  if (status === "active") {
    return <LoaderCircle className="animate-spin text-foreground" />;
  }

  if (status === "error") {
    return <CircleDashed className="text-destructive" />;
  }

  return <CircleDashed className="text-muted-foreground" />;
}
