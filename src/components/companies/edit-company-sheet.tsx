"use client";

import { useId, useState, useTransition } from "react";
import { PencilLine } from "lucide-react";
import { toast } from "sonner";

import {
  atsProviderOptions,
  companyStatusHelp,
  type CompanyFormValues,
} from "@/components/companies/company-form";
import { CompanyLogo } from "@/components/companies/company-logo";
import {
  DeleteCompanyDialog,
  type DeletableCompany,
} from "@/components/companies/delete-company-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  companyJobBoardNavigationModeOptions,
  companySizeOptions,
  companyStatusOptions,
} from "@/lib/companies";
import type { CompanyLogoView } from "@/lib/company-logos";
import { updateCompany } from "@/server/actions/companies";

type EditCompanySheetProps = {
  company: DeletableCompany;
  values: CompanyFormValues;
  logo: CompanyLogoView;
  /** Controlled by a list row. Without it the sheet brings its own trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Where focus goes on close when the sheet has no trigger of its own. */
  finalFocus?: React.ComponentProps<typeof SheetContent>["finalFocus"];
  /** Detail page: after deleting, go to the list. */
  redirectAfterDelete?: boolean;
};

type SaveError = "validation" | "not-found";

const saveErrorCopy: Record<SaveError, string> = {
  validation: "Não foi possível salvar. Revise o nome e as URLs informadas.",
  "not-found": "Esta empresa não existe mais. Recarregue a página.",
};

export function EditCompanySheet({
  company,
  values,
  logo,
  open,
  onOpenChange,
  finalFocus,
  redirectAfterDelete = false,
}: EditCompanySheetProps) {
  const idPrefix = useId();
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const formId = fieldId("form");

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The save button lives in the pinned footer, outside the form element.
  const [isSaving, startSaving] = useTransition();

  function setOpen(next: boolean) {
    if (next) {
      setSaveError(null);
    }

    if (!isControlled) {
      setUncontrolledOpen(next);
    }

    onOpenChange?.(next);
  }

  // onSubmit rather than a form action: React resets a form after its action
  // runs, which would wipe what was typed when the server rejects it.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startSaving(async () => {
      const result = await updateCompany(company.id, formData);

      if (result.ok) {
        setOpen(false);
        toast.success("Empresa atualizada", { description: formData.get("name")?.toString() });
        return;
      }

      setSaveError(result.error === "validation" ? "validation" : "not-found");
    });
  }

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !isSaving && setOpen(next)}>
      {isControlled ? null : (
        <SheetTrigger render={<Button variant="ghost" size="sm" />}>
          <PencilLine data-icon="inline-start" />
          Editar
        </SheetTrigger>
      )}
      <SheetContent
        side="right"
        showCloseButton
        finalFocus={finalFocus}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:sm:w-[min(36rem,92vw)] data-[side=right]:sm:max-w-none data-[side=right]:sm:border-l"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 pt-[max(1rem,env(safe-area-inset-top))] pr-14 pb-4 sm:px-6 sm:pt-6">
          <SheetTitle className="text-lg">Editar empresa</SheetTitle>
          <SheetDescription className="truncate">{values.name}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
            <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldSet>
                <FieldLegend>Identidade</FieldLegend>
                <FieldGroup className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={fieldId("name")}>Nome *</FieldLabel>
                    <Input
                      id={fieldId("name")}
                      name="name"
                      required
                      autoComplete="organization"
                      defaultValue={values.name}
                      placeholder="Ex.: Nimbus Pagamentos"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={fieldId("sector")}>Setor</FieldLabel>
                    <Input
                      id={fieldId("sector")}
                      name="sector"
                      defaultValue={values.sector}
                      placeholder="Ex.: Fintech, SaaS B2B"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={fieldId("website")}>Site</FieldLabel>
                    <Input
                      id={fieldId("website")}
                      name="website"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      defaultValue={values.website}
                      placeholder="https://empresa.com"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={fieldId("size")}>Porte</FieldLabel>
                    <Select items={companySizeOptions} defaultValue={values.size || undefined} name="size">
                      <SelectTrigger id={fieldId("size")} className="w-full">
                        <SelectValue placeholder="Selecione o porte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {companySizeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={fieldId("logo")}>Logo</FieldLabel>
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={values.name} {...logo} />
                      <Input
                        id={fieldId("logo")}
                        name="logoUrl"
                        type="url"
                        inputMode="url"
                        defaultValue={values.logoUrl}
                        placeholder="https://empresa.com/logo.png"
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <FieldDescription>
                      Opcional. Em branco, o logo vem do ícone do site.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldSet>

              {/* Hairlines live on wrappers: a border on the fieldset itself
                  would be drawn through its legend. */}
              <div className="border-t border-border pt-6">
                <FieldSet>
                  <FieldLegend>Board e status</FieldLegend>
                  <FieldGroup className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={fieldId("jobs-board")}>Job board</FieldLabel>
                      <Input
                        id={fieldId("jobs-board")}
                        name="jobsBoardUrl"
                        type="url"
                        inputMode="url"
                        defaultValue={values.jobsBoardUrl}
                        placeholder="https://careers.empresa.com"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={fieldId("glassdoor")}>Glassdoor</FieldLabel>
                      <Input
                        id={fieldId("glassdoor")}
                        name="glassdoorUrl"
                        type="url"
                        inputMode="url"
                        defaultValue={values.glassdoorUrl}
                        placeholder="https://www.glassdoor.com/..."
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={fieldId("nav")}>Navegação do job board</FieldLabel>
                      <Select
                        items={companyJobBoardNavigationModeOptions}
                        defaultValue={values.jobBoardNavigationMode || "fetch"}
                        name="jobBoardNavigationMode"
                      >
                        <SelectTrigger id={fieldId("nav")} className="w-full">
                          <SelectValue placeholder="Selecione o modo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {companyJobBoardNavigationModeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Browser renderizado só quando o board depende de paginação
                        client-side.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={fieldId("ats-provider")}>Provedor de ATS</FieldLabel>
                      <Select
                        items={atsProviderOptions}
                        defaultValue={values.atsProvider || "auto"}
                        name="atsProvider"
                      >
                        <SelectTrigger id={fieldId("ats-provider")} className="w-full">
                          <SelectValue placeholder="Selecione o provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {atsProviderOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        “Detectar automaticamente” identifica o provedor pela URL.
                      </FieldDescription>
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor={fieldId("status")}>Status da empresa</FieldLabel>
                      <Select
                        items={companyStatusOptions}
                        defaultValue={values.status || "monitoring"}
                        name="status"
                      >
                        <SelectTrigger id={fieldId("status")} className="w-full">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {companyStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>{companyStatusHelp}</FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </div>

              <div className="border-t border-border pt-6">
                <FieldSet>
                  <FieldLegend>Notas</FieldLegend>
                  <Field>
                    <FieldLabel htmlFor={fieldId("notes")} className="sr-only">
                      Notas
                    </FieldLabel>
                    <Textarea
                      id={fieldId("notes")}
                      name="notes"
                      defaultValue={values.notes}
                      placeholder="Sinais, impressões sobre cultura, ritmo de resposta, observações estratégicas."
                      className="min-h-28"
                    />
                  </Field>
                </FieldSet>
              </div>
            </form>

            <section className="flex flex-col gap-3 border-t border-border pt-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Excluir empresa
                </h3>
                <p className="mt-1 text-[13px] text-pretty text-muted-foreground">
                  {company.canDelete
                    ? "Remove a empresa e os leads do radar ligados a ela."
                    : "Disponível apenas quando não há candidaturas vinculadas."}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto sm:self-start"
                disabled={!company.canDelete || isSaving}
                onClick={() => setDeleteOpen(true)}
              >
                Excluir empresa
              </Button>
            </section>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
          {/* By the button that was just pressed, not scrolled out of view. */}
          {saveError ? (
            <Notice tone="negative" role="alert" className="mb-3">
              {saveErrorCopy[saveError]}
            </Notice>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <SheetClose render={<Button type="button" variant="ghost" disabled={isSaving} />}>
              Cancelar
            </SheetClose>
            <Button type="submit" form={formId} disabled={isSaving}>
              {isSaving ? "Salvando…" : "Salvar ajustes"}
            </Button>
          </div>
        </div>

        {/* Inside the popup, so it nests: pressing it doesn't dismiss the sheet. */}
        <DeleteCompanyDialog
          company={company}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          redirectToList={redirectAfterDelete}
        />
      </SheetContent>
    </Sheet>
  );
}
