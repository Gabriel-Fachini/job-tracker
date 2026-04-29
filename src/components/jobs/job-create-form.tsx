import Link from "next/link";

import { createJob } from "@/server/actions/jobs";
import {
  jobStatusOptions,
  seniorityOptions,
  sourceNameOptions,
  workModelOptions,
} from "@/lib/jobs";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type JobFormValues = {
  company?: string | null;
  title?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  status?: string | null;
  workModel?: string | null;
  seniority?: string | null;
};

type JobCreateFormProps = {
  action?: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  submitLabel: string;
  defaultValues?: JobFormValues;
};

export function JobCreateForm({
  action = createJob,
  cancelHref,
  submitLabel,
  defaultValues,
}: JobCreateFormProps) {
  const controlClassName =
    "h-10 w-full rounded-xl border border-border/70 bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form action={action} className="flex flex-col gap-8">
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="company" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
              Empresa
            </FieldLabel>
            <Input
              id="company"
              name="company"
              placeholder="Ex.: Nubank"
              defaultValue={defaultValues?.company ?? ""}
              className={controlClassName}
            />
            <FieldDescription>
              Por enquanto a empresa fica como texto livre, sem vínculo formal.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="title" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
              Título da vaga
            </FieldLabel>
            <Input
              id="title"
              name="title"
              placeholder="Ex.: Senior Frontend Engineer"
              defaultValue={defaultValues?.title ?? ""}
              required
              className={controlClassName}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sourceUrl" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
              URL original
            </FieldLabel>
            <Input
              id="sourceUrl"
              name="sourceUrl"
              type="url"
              placeholder="https://..."
              defaultValue={defaultValues?.sourceUrl ?? ""}
              className={controlClassName}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sourceName" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
              Origem
            </FieldLabel>
            <select
              id="sourceName"
              name="sourceName"
              defaultValue={defaultValues?.sourceName ?? "other"}
              className={controlClassName}
            >
              {sourceNameOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="status" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
              Status
            </FieldLabel>
            <select
              id="status"
              name="status"
              defaultValue={defaultValues?.status ?? "interesting"}
              className={controlClassName}
            >
              {jobStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="workModel" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
              Modelo de trabalho
            </FieldLabel>
            <select
              id="workModel"
              name="workModel"
              defaultValue={defaultValues?.workModel ?? ""}
              className={controlClassName}
            >
              <option value="">Não informado</option>
              {workModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="seniority" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
              Senioridade
            </FieldLabel>
            <select
              id="seniority"
              name="seniority"
              defaultValue={defaultValues?.seniority ?? ""}
              className={controlClassName}
            >
              <option value="">Não informado</option>
              {seniorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="description" className="text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
            Descrição da vaga em markdown
          </FieldLabel>
          <Textarea
            id="description"
            name="description"
            placeholder="Cole aqui a descrição completa da vaga."
            className="min-h-96 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue={defaultValues?.description ?? ""}
            required
          />
          <FieldDescription>
            O markdown fica salvo localmente como fonte de verdade da vaga.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-2">
        <Button type="submit" size="lg">
          {submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
