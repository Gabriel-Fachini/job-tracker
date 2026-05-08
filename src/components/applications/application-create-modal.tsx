"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, FileText, FolderOpen, Loader2, Sparkles, Waypoints } from "lucide-react";

import {
  createApplication,
  type ApplicationCreateResult,
  formatApplicationDescriptionWithAi,
} from "@/server/actions/applications";
import { generateResume, openResumeInFinder } from "@/server/actions/resume";
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
  "h-10 w-full rounded-xl border border-border/70 bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ApplicationCreateModal({
  companies,
  open,
  onOpenChange,
  initialValues,
  submitAction = createApplication,
  submitLabel = "Salvar candidatura",
  pendingLabel = "Salvando...",
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

  function handleOpenInFinder() {
    if (pdfPath) openResumeInFinder(pdfPath);
  }

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
      <DialogContent className="flex max-h-[90vh] sm:max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Waypoints className="size-5 text-muted-foreground" />
            {title}
          </DialogTitle>
          <DialogDescription>{descriptionValue}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-6 px-6 pb-6">
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
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
                      className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
                    >
                      Descrição da vaga em markdown *
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
                          <Loader2 className="mr-2 size-3.5 animate-spin" />
                          Formatando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 size-3.5" />
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
                    className="min-h-52 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                    className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Notas
                  </FieldLabel>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Observações sobre o processo..."
                    defaultValue={defaults.notes}
                    className="min-h-20 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                    Gerando currículo com IA...
                  </div>
                ) : resumePhase === "done" && pdfPath ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-green-400">Currículo gerado com sucesso.</span>
                    <Button size="sm" variant="outline" onClick={handleOpenInFinder} className="gap-1.5">
                      <FolderOpen className="size-3.5" />
                      Abrir no Finder
                    </Button>
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

        <div className="shrink-0 border-t border-border/60 px-6 py-4">
          {created ? (
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="application-create-form"
                  disabled={isPending || !hasCompanies}
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
