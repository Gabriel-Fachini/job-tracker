"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ExternalLink, FileText, Loader2, Sparkles, Waypoints } from "lucide-react";

import {
  createApplication,
  type ApplicationCreateResult,
  formatApplicationDescriptionWithAi,
} from "@/server/actions/applications";
import { generateResume } from "@/server/actions/resume";
import { applicationStatusOptions } from "@/lib/applications";
import {
  seniorityOptions,
  sourceNameOptions,
  workModelOptions,
} from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResumePhase = "idle" | "generating" | "done" | "error";

type ApplicationCreateModalProps = {
  companies: Array<{ id: number; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<ApplicationCreateInitialValues>;
  submitAction?: (
    prev: ApplicationCreateResult | null,
    formData: FormData,
  ) => Promise<ApplicationCreateResult>;
  submitLabel?: string;
  pendingLabel?: string;
  title?: string;
  descriptionValue?: string;
};

export type ApplicationCreateInitialValues = {
  leadId: number;
  title: string;
  companyId: string;
  description: string;
  sourceUrl: string;
  sourceName: string;
  workModel: string;
  seniority: string;
  status: string;
  notes: string;
};

const controlClassName =
  "h-10 w-full rounded-xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ApplicationCreateModal({
  companies,
  open,
  onOpenChange,
  initialValues,
  submitAction = createApplication,
  submitLabel = "Salvar candidatura",
  pendingLabel = "Salvando…",
  title = "Nova candidatura",
  descriptionValue = "Registre a vaga e o status inicial do seu processo seletivo.",
}: ApplicationCreateModalProps) {
  const defaults = {
    title: initialValues?.title ?? "",
    companyId: initialValues?.companyId ?? "",
    description: initialValues?.description ?? "",
    sourceUrl: initialValues?.sourceUrl ?? "",
    sourceName: initialValues?.sourceName ?? "other",
    workModel: initialValues?.workModel ?? "",
    seniority: initialValues?.seniority ?? "",
    status: initialValues?.status ?? "applied",
    notes: initialValues?.notes ?? "",
  };

  const formRef = useRef<HTMLFormElement>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [resumePhase, setResumePhase] = useState<ResumePhase>("idle");
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [descriptionValueError, setDescriptionError] = useState<string | null>(null);
  const [description, setDescription] = useState(defaults.description);
  const [, startGenerating] = useTransition();

  const created = applicationId !== null;
  const hasCompanies = companies.length > 0;

  function handleGenerateResume(id: number) {
    setResumeError(null);
    setResumePhase("generating");
    startGenerating(async () => {
      const result = await generateResume(id);
      if (result.success) {
        setPdfPath(result.filePath);
        setResumePhase("done");
      } else {
        setResumeError(result.error);
        setResumePhase("error");
      }
    });
  }

  async function handleSubmit(
    prev: ApplicationCreateResult | null,
    formData: FormData,
  ) {
    const result = await submitAction(prev, formData);

    if (result.success) {
      setApplicationId(result.id);
      setDescription("");
      setDescriptionError(null);
      formRef.current?.reset();
      handleGenerateResume(result.id);
    }

    return result;
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, null);
  const hasSubmitError = state && !state.success;

  async function handleFormatDescription() {
    if (!defaults.description && !description) return;

    setDescriptionError(null);
    setIsFormatting(true);

    try {
      const result = await formatApplicationDescriptionWithAi(description || defaults.description);

      if (!result.success) {
        setDescriptionError(result.error);
      } else {
        setDescription(result.formatted);
      }
    } catch {
      setDescriptionError("Erro ao formatar a descrição.");
    } finally {
      setIsFormatting(false);
    }
  }

  function resetModalState() {
    setApplicationId(null);
    setResumePhase("idle");
    setPdfPath(null);
    setResumeError(null);
    setDescription(defaults.description);
    setDescriptionError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetModalState();
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent sheetSize="full" className="flex flex-col gap-0 p-0 sm:max-h-[90vh] sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border/40 px-4 pt-5 pr-14 pb-4 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg leading-tight sm:text-xl">
            <Waypoints aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            {title}
          </DialogTitle>
          <DialogDescription>{descriptionValue}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
            {/* ── Success banner ── */}
            {created ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                <CheckCircle2 className="size-4 shrink-0" />
                Candidatura criada com sucesso.
              </div>
            ) : null}

            {/* ── Form ── */}
            <form
              ref={formRef}
              id="application-create-form"
              action={formAction}
              className="flex flex-col gap-6"
            >
              {typeof initialValues?.leadId === "number" ? (
                <input
                  type="hidden"
                  name="leadId"
                  value={String(initialValues.leadId)}
                />
              ) : null}

              {hasSubmitError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  Não foi possível salvar. Revise os campos obrigatórios, incluindo a empresa selecionada, e a URL.
                </p>
              ) : null}

              {!hasCompanies ? (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Cadastre ao menos uma empresa antes de registrar uma candidatura.
                </div>
              ) : null}

              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel
                      htmlFor="title"
                      className="text-sm font-medium text-foreground/85"
                    >
                      Título da vaga *
                    </FieldLabel>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Ex.: Senior Frontend Engineer"
                      required
                      defaultValue={defaults.title}
                      className={controlClassName}
                      disabled={created}
                    />
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="companyId"
                      className="text-sm font-medium text-foreground/85"
                    >
                      Empresa *
                    </FieldLabel>
                    <select
                      id="companyId"
                      name="companyId"
                      required
                      defaultValue={defaults.companyId}
                      className={controlClassName}
                      disabled={created}
                    >
                      <option value="" disabled>
                        Selecione uma empresa cadastrada
                      </option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    <FieldDescription>
                      A candidatura sempre precisa pertencer a uma empresa já cadastrada.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="status"
                      className="text-sm font-medium text-foreground/85"
                    >
                      Status
                    </FieldLabel>
                    <select
                      id="status"
                      name="status"
                      defaultValue={defaults.status}
                      className={controlClassName}
                      disabled={created}
                    >
                      {applicationStatusOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="workModel"
                      className="text-sm font-medium text-foreground/85"
                    >
                      Modelo de trabalho
                    </FieldLabel>
                    <select
                      id="workModel"
                      name="workModel"
                      defaultValue={defaults.workModel}
                      className={controlClassName}
                      disabled={created}
                    >
                      <option value="">Não informado</option>
                      {workModelOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="seniority"
                      className="text-sm font-medium text-foreground/85"
                    >
                      Senioridade
                    </FieldLabel>
                    <select
                      id="seniority"
                      name="seniority"
                      defaultValue={defaults.seniority}
                      className={controlClassName}
                      disabled={created}
                    >
                      <option value="">Não informado</option>
                      {seniorityOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="sourceName"
                      className="text-sm font-medium text-foreground/85"
                    >
                      Origem
                    </FieldLabel>
                    <select
                      id="sourceName"
                      name="sourceName"
                      defaultValue={defaults.sourceName}
                      className={controlClassName}
                      disabled={created}
                    >
                      {sourceNameOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field className="sm:col-span-2">
                    <FieldLabel
                      htmlFor="sourceUrl"
                      className="text-sm font-medium text-foreground/85"
                    >
                      URL original
                    </FieldLabel>
                    <Input
                      id="sourceUrl"
                      name="sourceUrl"
                      type="url"
                      placeholder="https://..."
                      defaultValue={defaults.sourceUrl}
                      className={controlClassName}
                      disabled={created}
                    />
                  </Field>
                </div>

                <Field>
                  <div className="flex items-start justify-between gap-3">
                    <FieldLabel
                      htmlFor="description"
                      className="text-sm font-medium text-foreground/85"
                    >
                      Descrição da vaga (markdown) *
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFormatDescription}
                      disabled={isFormatting || !description.trim()}
                      className="rounded-lg"
                    >
                      {isFormatting ? (
                        <>
                          <Loader2 data-icon="inline-start" className="animate-spin" />
                          Formatando…
                        </>
                      ) : (
                        <>
                          <Sparkles data-icon="inline-start" />
                          Formatar
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Cole aqui a descrição completa da vaga."
                    required
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setDescriptionError(null);
                    }}
                    className="min-h-52 rounded-xl border border-input bg-input/30 px-3 py-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    disabled={created}
                  />
                  <FieldDescription className="mt-2">
                    O markdown fica salvo localmente como fonte de verdade da vaga.
                  </FieldDescription>
                  {descriptionValueError ? (
                    <p className="mt-2 text-sm text-destructive">{descriptionValueError}</p>
                  ) : null}
                </Field>

                <Field>
                  <FieldLabel
                    htmlFor="notes"
                    className="text-sm font-medium text-foreground/85"
                  >
                    Notas
                  </FieldLabel>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Observações sobre o processo..."
                    defaultValue={defaults.notes}
                    className="min-h-20 rounded-xl border border-input bg-input/30 px-3 py-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    disabled={created}
                  />
                </Field>
              </FieldGroup>
            </form>

            {/* ── Resume generation section ── */}
            {created ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Currículo personalizado</span>
                </div>

                {resumePhase === "generating" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Gerando currículo com IA…
                  </div>
                ) : resumePhase === "done" && pdfPath ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-green-400">Currículo gerado com sucesso.</span>
                    <a
                      href={`/api/applications/${applicationId}/generated-resume`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                    >
                      <ExternalLink className="size-3.5" />
                      Abrir PDF
                    </a>
                  </div>
                ) : resumePhase === "error" && resumeError ? (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {resumeError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border/60 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          {created ? (
            <div className="flex justify-end">
              <Button size="lg" onClick={() => onOpenChange(false)} className="w-full rounded-xl sm:w-auto">
                Fechar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  form="application-create-form"
                  disabled={isPending || !hasCompanies}
                  className="rounded-xl"
                >
                  {isPending ? pendingLabel : submitLabel}
                </Button>
              </div>
              {!hasCompanies ? (
                <div className="flex justify-end">
                  <Link
                    href="/companies/new"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "rounded-lg",
                    )}
                  >
                    <Building2 data-icon="inline-start" />
                    Cadastrar empresa primeiro
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DialogTrigger as ApplicationCreateTrigger };
