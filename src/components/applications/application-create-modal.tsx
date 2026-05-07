"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Building2, Waypoints } from "lucide-react";

import {
  createApplication,
  type ApplicationCreateResult,
} from "@/server/actions/applications";
import { applicationStatusOptions } from "@/lib/applications";
import {
  seniorityOptions,
  sourceNameOptions,
  workModelOptions,
} from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

type ApplicationCreateModalProps = {
  companies: Array<{
    id: number;
    name: string;
  }>;
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
  description?: string;
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
  description = "Registre a vaga e o status inicial do seu processo seletivo.",
}: ApplicationCreateModalProps) {
  const [state, formAction, isPending] = useActionState(
    submitAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      formRef.current?.reset();
    }
  }, [state, onOpenChange]);

  const hasError = state && !state.success;
  const hasCompanies = companies.length > 0;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] sm:max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Waypoints className="size-5 text-muted-foreground" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <form
            ref={formRef}
            id="application-create-form"
            action={formAction}
            className="flex flex-col gap-6 px-6 pb-6"
          >
            {typeof initialValues?.leadId === "number" ? (
              <input type="hidden" name="leadId" value={String(initialValues.leadId)} />
            ) : null}

            {hasError ? (
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
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel
                  htmlFor="description"
                  className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Descrição da vaga em markdown *
                </FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Cole aqui a descrição completa da vaga."
                  required
                  defaultValue={defaults.description}
                  className="min-h-52 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <FieldDescription>
                  O markdown fica salvo localmente como fonte de verdade da
                  vaga.
                </FieldDescription>
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
                />
              </Field>
            </FieldGroup>
          </form>
        </ScrollArea>

        <div className="shrink-0 border-t border-border/60 px-6 py-4">
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
            <div className="mt-3 flex justify-end">
              <Link
                href="/companies/new"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}
              >
                <Building2 data-icon="inline-start" />
                Cadastrar empresa primeiro
              </Link>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Trigger convenience export
export { DialogTrigger as ApplicationCreateTrigger };
