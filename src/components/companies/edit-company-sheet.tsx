"use client";

import { useState } from "react";
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

const inputClassName =
  "h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const textareaClassName =
  "min-h-36 rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function EditCompanySheet({
  action,
  deleteAction,
  values,
  hasValidationError,
  hasLinkedApplicationsError,
  canDelete,
}: EditCompanySheetProps) {
  const [open, setOpen] = useState(hasValidationError || hasLinkedApplicationsError);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" className="shrink-0 rounded-xl" />}>
        <PencilLine className="size-3.5" />
        Editar
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton
        className="flex flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6">
          <SheetTitle>Editar empresa</SheetTitle>
          <SheetDescription>
            Atualize a ficha sem perder o vínculo com as candidaturas já
            associadas.
          </SheetDescription>
        </SheetHeader>

        <form
          action={isDeleting ? deleteAction : action}
          className="flex min-h-0 flex-1 flex-col overflow-hidden gap-0"
        >
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col gap-8 px-6 py-6">
              {hasValidationError ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
                  Não foi possível atualizar a empresa. Revise o nome e as URLs
                  informadas.
                </div>
              ) : null}

              <FieldSet>
                <FieldLegend>Identidade da empresa</FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="edit-company-name">Nome *</FieldLabel>
                    <Input
                      id="edit-company-name"
                      name="name"
                      required
                      defaultValue={values.name}
                      placeholder="Ex.: Nubank"
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
                      defaultValue={values.website}
                      placeholder="https://empresa.com"
                      className={inputClassName}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-size">Porte</FieldLabel>
                    <Select defaultValue={values.size || undefined} name="size">
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
                      Use browser renderizado apenas quando o board depender de
                      paginação client-side.
                    </FieldDescription>
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="edit-company-status">
                      Status da empresa
                    </FieldLabel>
                    <Select
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
                    <FieldDescription>
                      `Em processo` é aplicado automaticamente com candidaturas
                      em {companyAutomationStatusLabels.join(", ")}. `Blacklist`
                      não é sobrescrito pelo sync automático.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <Field>
                <FieldLabel htmlFor="edit-company-notes">Notas</FieldLabel>
                <Textarea
                  id="edit-company-notes"
                  name="notes"
                  defaultValue={values.notes}
                  placeholder="Anote sinais, impressões sobre cultura, ritmo de resposta e observações estratégicas."
                  className={textareaClassName}
                />
              </Field>
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-border/40 bg-background/20 px-6 py-5">
            <div className="flex justify-end gap-3">
              <SheetClose render={<Button type="button" variant="outline" className="rounded-xl" />}>
                Cancelar
              </SheetClose>
              <FormSubmitButton pendingLabel="Salvando ajustes...">
                Salvar ajustes
              </FormSubmitButton>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/40 px-6 py-5">
            {hasLinkedApplicationsError ? (
              <p className="mb-3 text-sm text-amber-300/90">
                Empresa com candidaturas vinculadas não pode ser excluída.
              </p>
            ) : null}
            {!canDelete && !hasLinkedApplicationsError ? (
              <p className="mb-3 text-xs text-muted-foreground">
                Exclusão disponível apenas quando não há candidaturas vinculadas.
              </p>
            ) : null}
            <button
              type="submit"
              onClick={() => setIsDeleting(true)}
              disabled={!canDelete}
              className="w-full inline-flex h-10 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Excluir empresa
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
