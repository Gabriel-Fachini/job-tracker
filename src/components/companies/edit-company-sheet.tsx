"use client";

import { useState, useTransition } from "react";
import { PencilLine } from "lucide-react";

import {
  companyAutomationStatusLabels,
  companyJobBoardNavigationModeOptions,
  companySizeOptions,
  companyStatusOptions,
} from "@/lib/companies";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { FormSubmitButton } from "@/components/companies/form-submit-button";
import type { CompanyFormValues } from "@/components/companies/company-form";

type EditCompanySheetProps = {
  action: (fd: FormData) => void | Promise<void>;
  deleteAction: (fd: FormData) => void | Promise<void>;
  values: CompanyFormValues;
  hasValidationError: boolean;
  hasLinkedApplicationsError: boolean;
  canDelete: boolean;
};

const EDIT_FORM_ID = "edit-company-form";

const inputClassName =
  "h-11 w-full rounded-xl border border-input bg-input/30 px-3 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const textareaClassName =
  "min-h-36 rounded-xl border border-input bg-input/30 px-3 py-3 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function EditCompanySheet({
  action,
  deleteAction,
  values,
  hasValidationError,
  hasLinkedApplicationsError,
  canDelete,
}: EditCompanySheetProps) {
  const [open, setOpen] = useState(hasValidationError || hasLinkedApplicationsError);
  // The save button lives in the pinned footer, outside the form element.
  const [isSaving, startSaving] = useTransition();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" className="shrink-0 rounded-lg" />}>
        <PencilLine data-icon="inline-start" />
        Editar
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:sm:w-[min(36rem,92vw)] data-[side=right]:sm:max-w-none data-[side=right]:sm:border-l"
      >
        <SheetHeader className="shrink-0 border-b border-border/40 px-4 pt-[max(1rem,env(safe-area-inset-top))] pr-14 pb-4 sm:px-6 sm:pt-6">
          <SheetTitle className="text-lg">Editar empresa</SheetTitle>
          <SheetDescription>
            As candidaturas associadas continuam vinculadas.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-8 px-4 py-5 sm:px-6 sm:py-6">
            <form
              id={EDIT_FORM_ID}
              action={(formData) => startSaving(() => action(formData))}
              className="flex flex-col gap-8"
            >
              {hasValidationError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  Não foi possível atualizar a empresa. Revise o nome e as URLs
                  informadas.
                </div>
              ) : null}

              <FieldSet>
                <FieldLegend>Identidade</FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="edit-company-name">Nome *</FieldLabel>
                    <Input
                      id="edit-company-name"
                      name="name"
                      required
                      autoComplete="organization"
                      defaultValue={values.name}
                      placeholder="Ex.: Nimbus Pagamentos"
                      className={inputClassName}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-sector">Setor</FieldLabel>
                    <Input
                      id="edit-company-sector"
                      name="sector"
                      defaultValue={values.sector}
                      placeholder="Ex.: Fintech, SaaS B2B"
                      className={inputClassName}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-website">Site</FieldLabel>
                    <Input
                      id="edit-company-website"
                      name="website"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      defaultValue={values.website}
                      placeholder="https://empresa.com"
                      className={inputClassName}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-size">Porte</FieldLabel>
                    <Select items={companySizeOptions} defaultValue={values.size || undefined} name="size">
                      <SelectTrigger className="h-11 w-full rounded-xl" id="edit-company-size">
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
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Links e status</FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="edit-company-jobs-board">
                      Job board
                    </FieldLabel>
                    <Input
                      id="edit-company-jobs-board"
                      name="jobsBoardUrl"
                      type="url"
                      inputMode="url"
                      defaultValue={values.jobsBoardUrl}
                      placeholder="https://careers.empresa.com"
                      className={inputClassName}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-glassdoor">
                      Glassdoor
                    </FieldLabel>
                    <Input
                      id="edit-company-glassdoor"
                      name="glassdoorUrl"
                      type="url"
                      inputMode="url"
                      defaultValue={values.glassdoorUrl}
                      placeholder="https://www.glassdoor.com/..."
                      className={inputClassName}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-nav">
                      Navegação do job board
                    </FieldLabel>
                    <Select
                      items={companyJobBoardNavigationModeOptions}
                      defaultValue={values.jobBoardNavigationMode || "fetch"}
                      name="jobBoardNavigationMode"
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl" id="edit-company-nav">
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
                      Browser renderizado só quando o board pagina no client-side.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-status">
                      Status da empresa
                    </FieldLabel>
                    <Select
                      items={companyStatusOptions}
                      defaultValue={values.status || "monitoring"}
                      name="status"
                    >
                      <SelectTrigger
                        className="h-11 w-full rounded-xl"
                        id="edit-company-status"
                      >
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
                  </Field>
                  <FieldDescription className="sm:col-span-2">
                    Em processo é aplicado automaticamente com candidaturas em{" "}
                    {companyAutomationStatusLabels.join(", ")}. Blacklist não é
                    sobrescrito pelo sync automático.
                  </FieldDescription>
                </FieldGroup>
              </FieldSet>

              <Field>
                <FieldLabel htmlFor="edit-company-notes">Notas</FieldLabel>
                <Textarea
                  id="edit-company-notes"
                  name="notes"
                  defaultValue={values.notes}
                  placeholder="Sinais, impressões sobre cultura, ritmo de resposta, observações estratégicas."
                  className={textareaClassName}
                />
              </Field>
            </form>

            {/* A separate form: it can't nest inside the edit form above. */}
            <form
              action={deleteAction}
              className="flex flex-col gap-3 rounded-2xl border border-destructive/25 p-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">Excluir empresa</p>
                <p className="mt-1 text-sm text-pretty text-muted-foreground">
                  {hasLinkedApplicationsError
                    ? "Empresa com candidaturas vinculadas não pode ser excluída."
                    : canDelete
                      ? "Remove a empresa da base. Não dá para desfazer."
                      : "Disponível apenas quando não há candidaturas vinculadas."}
                </p>
              </div>
              <FormSubmitButton
                pendingLabel="Excluindo…"
                variant="destructive"
                className="w-full rounded-xl sm:w-auto sm:self-start"
                disabled={!canDelete}
              >
                Excluir empresa
              </FormSubmitButton>
            </form>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border/40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3">
            <SheetClose
              render={<Button type="button" variant="outline" size="lg" className="rounded-xl" />}
            >
              Cancelar
            </SheetClose>
            <Button
              type="submit"
              form={EDIT_FORM_ID}
              size="lg"
              disabled={isSaving}
              className="rounded-xl"
            >
              {isSaving ? "Salvando…" : "Salvar ajustes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
