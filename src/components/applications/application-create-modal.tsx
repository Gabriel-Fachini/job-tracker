"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Loader2, Sparkles } from "lucide-react";

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
import { Button, buttonVariants } from "@/components/ui/button";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Status } from "@/components/ui/status";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

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

/**
 * Native select dressed as `SelectTrigger`: keeps required validation, form
 * reset and the system picker on phones (16px there, so iOS doesn't zoom).
 * An empty placeholder/"Não informado" option reads in subtle text.
 */

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
        <DialogHeader className="shrink-0 gap-1.5 border-b border-border px-4 pt-5 pr-14 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
          <DialogTitle className="text-lg leading-snug text-balance sm:text-xl">
            {title}
          </DialogTitle>
          <DialogDescription>{descriptionValue}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
            {created ? (
              <Notice tone="positive" bordered>
                Candidatura criada com sucesso.
              </Notice>
            ) : null}

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
                <Notice tone="negative" bordered>
                  Não foi possível salvar. Revise os campos obrigatórios, incluindo a empresa selecionada, e a URL.
                </Notice>
              ) : null}

              {!hasCompanies ? (
                <Notice tone="caution" bordered>
                  Cadastre ao menos uma empresa antes de registrar uma candidatura.
                </Notice>
              ) : null}

              <FieldGroup>
                <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-4">
                  <Field>
                    <FieldLabel htmlFor="title">Título da vaga *</FieldLabel>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Ex.: Senior Frontend Engineer"
                      required
                      defaultValue={defaults.title}
                      disabled={created}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="companyId">Empresa *</FieldLabel>
                    <NativeSelect
                      id="companyId"
                      name="companyId"
                      required
                      defaultValue={defaults.companyId}
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
                    </NativeSelect>
                    <FieldDescription>
                      A candidatura sempre precisa pertencer a uma empresa já cadastrada.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <NativeSelect
                      id="status"
                      name="status"
                      defaultValue={defaults.status}
                      disabled={created}
                    >
                      {applicationStatusOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="workModel">Modelo de trabalho</FieldLabel>
                    <NativeSelect
                      id="workModel"
                      name="workModel"
                      defaultValue={defaults.workModel}
                      disabled={created}
                    >
                      <option value="">Não informado</option>
                      {workModelOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="seniority">Senioridade</FieldLabel>
                    <NativeSelect
                      id="seniority"
                      name="seniority"
                      defaultValue={defaults.seniority}
                      disabled={created}
                    >
                      <option value="">Não informado</option>
                      {seniorityOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="sourceName">Origem</FieldLabel>
                    <NativeSelect
                      id="sourceName"
                      name="sourceName"
                      defaultValue={defaults.sourceName}
                      disabled={created}
                    >
                      {sourceNameOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>

                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="sourceUrl">URL original</FieldLabel>
                    <Input
                      id="sourceUrl"
                      name="sourceUrl"
                      type="url"
                      placeholder="https://…"
                      defaultValue={defaults.sourceUrl}
                      disabled={created}
                    />
                  </Field>
                </div>

                <Field>
                  <div className="flex items-end justify-between gap-3">
                    <FieldLabel htmlFor="description">
                      Descrição da vaga (markdown) *
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFormatDescription}
                      disabled={isFormatting || !description.trim()}
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
                    className="min-h-48"
                    disabled={created}
                  />
                  <FieldDescription>
                    O markdown fica salvo localmente como fonte de verdade da vaga.
                  </FieldDescription>
                  {descriptionValueError ? (
                    <FieldError>{descriptionValueError}</FieldError>
                  ) : null}
                </Field>

                <Field>
                  <FieldLabel htmlFor="notes">Notas</FieldLabel>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Observações sobre o processo…"
                    defaultValue={defaults.notes}
                    disabled={created}
                  />
                </Field>
              </FieldGroup>
            </form>

            {created ? (
              <section className="flex flex-col gap-3 border-t border-border pt-5">
                <h3 className="text-sm font-medium text-foreground">Currículo personalizado</h3>

                {resumePhase === "generating" ? (
                  <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                    Gerando currículo com IA…
                  </p>
                ) : resumePhase === "done" && pdfPath ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Status tone="positive">Currículo gerado com sucesso.</Status>
                    <a
                      href={`/api/applications/${applicationId}/generated-resume`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Abrir PDF
                      <ExternalLink data-icon="inline-end" />
                    </a>
                  </div>
                ) : resumePhase === "error" && resumeError ? (
                  <Notice tone="negative">{resumeError}</Notice>
                ) : null}
              </section>
            ) : null}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
          {created ? (
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Fechar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {!hasCompanies ? (
                <Link href="/companies/new" className={buttonVariants({ variant: "ghost" })}>
                  <Building2 data-icon="inline-start" />
                  Cadastrar empresa primeiro
                </Link>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:items-center">
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DialogTrigger as ApplicationCreateTrigger };
