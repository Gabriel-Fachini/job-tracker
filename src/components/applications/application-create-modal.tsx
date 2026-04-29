"use client";

import { useActionState, useEffect, useRef } from "react";
import { Waypoints } from "lucide-react";

import { createApplication } from "@/server/actions/applications";
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

type ApplicationCreateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const controlClassName =
  "h-10 w-full rounded-xl border border-border/70 bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ApplicationCreateModal({
  open,
  onOpenChange,
}: ApplicationCreateModalProps) {
  const [state, formAction, isPending] = useActionState(
    createApplication,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] sm:max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Waypoints className="size-5 text-muted-foreground" />
            Nova candidatura
          </DialogTitle>
          <DialogDescription>
            Registre a vaga e o status inicial do seu processo seletivo.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <form
            ref={formRef}
            id="application-create-form"
            action={formAction}
            className="flex flex-col gap-6 px-6 pb-6"
          >
            {hasError ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Não foi possível salvar. Revise os campos obrigatórios e a URL.
              </p>
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
                    className={controlClassName}
                  />
                </Field>

                <Field>
                  <FieldLabel
                    htmlFor="company"
                    className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Empresa
                  </FieldLabel>
                  <Input
                    id="company"
                    name="company"
                    placeholder="Ex.: Nubank"
                    className={controlClassName}
                  />
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
                    defaultValue="interesting"
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
                    defaultValue=""
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
                    defaultValue=""
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
                    defaultValue="other"
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
              disabled={isPending}
            >
              {isPending ? "Salvando..." : "Salvar candidatura"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Trigger convenience export
export { DialogTrigger as ApplicationCreateTrigger };
