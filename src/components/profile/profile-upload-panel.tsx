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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export function ProfileUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, setStatus] = useState<{
    tone: "idle" | "success" | "error";
    title: string;
    detail: string;
  }>({
    tone: "idle",
    title: "Upload e extração",
    detail:
      "Envie um PDF e o app salvará o currículo master localmente antes de pedir ao modelo local para estruturar seu perfil.",
  });
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
      label: "Processando no modelo local",
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
            startedAt: step.startedAt ?? Date.now(),
            finishedAt: null,
          };
        }

        if ((status === "done" || status === "error") && step.startedAt) {
          return {
            ...step,
            status,
            finishedAt: Date.now(),
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
        label: "Processando no modelo local",
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
    setIsSubmitting(true);
    setNowMs(Date.now());
    resetSteps();
    updateStep("text", "active");
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
      updateStep("text", "error");
      setIsSubmitting(false);
      return;
    }

    if (!uploadPayload.ok) {
      setStatus({
        tone: "error",
        title: "Falha no upload",
        detail: uploadPayload.error,
      });
      updateStep("text", "error");
      setIsSubmitting(false);
      return;
    }

    updateStep("text", "done");
    updateStep("model", "active");
    setStatus({
      tone: "idle",
      title: "Executando o modelo local",
      detail: "O texto do PDF foi extraído. Agora o perfil está sendo estruturado pelo modelo local.",
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
        updateStep("model", "error");
        setIsSubmitting(false);
        return;
      }

      updateStep("model", "done");
      updateStep("database", "active");
      setStatus({
        tone: "idle",
        title: "Salvando o perfil",
        detail: "A extração terminou. Agora o perfil estruturado está sendo persistido no banco local.",
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
        updateStep("database", "error");
        setIsSubmitting(false);
        return;
      }

      updateStep("database", "done");
      setStatus({
        tone: "success",
        title: "Perfil atualizado",
        detail: `${uploadPayload.originalFilename} foi salvo localmente e o perfil extraído agora tem ${result.summary.experiences} experiências, ${result.summary.skills} habilidades, ${result.summary.projects} projetos e ${result.summary.education} registros de formação.`,
      });

      fileInputRef.current?.form?.reset();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload do currículo master</CardTitle>
        <CardDescription>
          Esta fase mantém o fluxo local-first: salva o PDF original em disco,
          extrai o texto no servidor e executa a extração do perfil apenas no
          modelo local.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-base text-foreground">
            <span className="font-medium">Currículo em PDF</span>
            <input
              ref={fileInputRef}
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="block w-full rounded-lg border border-dashed border-border bg-background px-5 py-7 text-base text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:border-primary/45"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-muted-foreground sm:max-w-md">
              Apenas PDF. A implementação atual cobre o fluxo principal local e
              deixa intencionalmente a trilha de comparação fora desta tela.
            </p>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <LoaderCircle className="animate-spin" /> : <FileUp />}
              {isLoading ? "Extraindo..." : "Enviar e extrair"}
            </Button>
          </div>
        </form>

        <div className="rounded-xl border border-border bg-background/60 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Etapas do processamento</p>
          <div className="mt-3 flex flex-col gap-3">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-3 text-sm">
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
          className={`rounded-xl border px-5 py-4 text-base ${
            status.tone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : status.tone === "success"
                ? "border-primary/30 bg-primary/8 text-foreground"
                : "border-border bg-muted/35 text-muted-foreground"
          }`}
        >
          <p className="font-medium">{status.title}</p>
          <p className="mt-1 leading-7">{status.detail}</p>
        </div>
      </CardContent>
    </Card>
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
    return <CheckCircle2 className="size-5 text-primary" />;
  }

  if (status === "active") {
    return <LoaderCircle className="size-5 animate-spin text-primary" />;
  }

  if (status === "error") {
    return <CircleDashed className="size-5 text-destructive" />;
  }

  return <CircleDashed className="size-5 text-muted-foreground" />;
}
