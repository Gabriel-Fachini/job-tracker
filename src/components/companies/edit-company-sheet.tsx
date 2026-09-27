"use client";

import { useState, useTransition } from "react";
import { PencilLine } from "lucide-react";

import {
  atsProviderOptions,
  automationStatusList,
  type CompanyFormValues,
} from "@/components/companies/company-form";
import { FormSubmitButton } from "@/components/companies/form-submit-button";
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

type EditCompanySheetProps = {
  action: (fd: FormData) => void | Promise<void>;
  deleteAction: (fd: FormData) => void | Promise<void>;
  values: CompanyFormValues;
  hasValidationError: boolean;
  hasLinkedApplicationsError: boolean;
  canDelete: boolean;
};

const EDIT_FORM_ID = "edit-company-form";

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
      <SheetTrigger render={<Button variant="ghost" size="sm" />}>
        <PencilLine data-icon="inline-start" />
        Editar
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:sm:w-[min(36rem,92vw)] data-[side=right]:sm:max-w-none data-[side=right]:sm:border-l"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 pt-[max(1rem,env(safe-area-inset-top))] pr-14 pb-4 sm:px-6 sm:pt-6">
          <SheetTitle className="text-lg">Editar empresa</SheetTitle>
          <SheetDescription>
            As candidaturas associadas continuam vinculadas.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
            {/* Errors sit on top: the sheet reopens scrolled to the start. */}
            {hasValidationError ? (
              <Notice tone="negative" bordered>
                Não foi possível atualizar a empresa. Revise o nome e as URLs
                informadas.
              </Notice>
            ) : null}
            {hasLinkedApplicationsError ? (
              <Notice tone="negative" bordered>
                Empresa com candidaturas vinculadas não pode ser excluída.
              </Notice>
            ) : null}

            <form
              id={EDIT_FORM_ID}
              action={(formData) => startSaving(() => action(formData))}
              className="flex flex-col gap-6"
            >
              <FieldSet>
                <FieldLegend>Identidade</FieldLegend>
                <FieldGroup className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="edit-company-name">Nome *</FieldLabel>
                    <Input
                      id="edit-company-name"
                      name="name"
                      required
                      autoComplete="organization"
                      defaultValue={values.name}
                      placeholder="Ex.: Nimbus Pagamentos"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-sector">Setor</FieldLabel>
                    <Input
                      id="edit-company-sector"
                      name="sector"
                      defaultValue={values.sector}
                      placeholder="Ex.: Fintech, SaaS B2B"
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
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-company-size">Porte</FieldLabel>
                    <Select items={companySizeOptions} defaultValue={values.size || undefined} name="size">
                      <SelectTrigger id="edit-company-size" className="w-full">
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

              {/* Hairlines live on wrappers: a border on the fieldset itself
                  would be drawn through its legend. */}
              <div className="border-t border-border pt-6">
                <FieldSet>
                  <FieldLegend>Board e status</FieldLegend>
                  <FieldGroup className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="edit-company-jobs-board">Job board</FieldLabel>
                      <Input
                        id="edit-company-jobs-board"
                        name="jobsBoardUrl"
                        type="url"
                        inputMode="url"
                        defaultValue={values.jobsBoardUrl}
                        placeholder="https://careers.empresa.com"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="edit-company-glassdoor">Glassdoor</FieldLabel>
                      <Input
                        id="edit-company-glassdoor"
                        name="glassdoorUrl"
                        type="url"
                        inputMode="url"
                        defaultValue={values.glassdoorUrl}
                        placeholder="https://www.glassdoor.com/..."
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
                        <SelectTrigger id="edit-company-nav" className="w-full">
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
                      <FieldLabel htmlFor="edit-company-ats-provider">
                        Provedor de ATS
                      </FieldLabel>
                      <Select
                        items={atsProviderOptions}
                        defaultValue={values.atsProvider || "auto"}
                        name="atsProvider"
                      >
                        <SelectTrigger id="edit-company-ats-provider" className="w-full">
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
                      <FieldLabel htmlFor="edit-company-status">
                        Status da empresa
                      </FieldLabel>
                      <Select
                        items={companyStatusOptions}
                        defaultValue={values.status || "monitoring"}
                        name="status"
                      >
                        <SelectTrigger id="edit-company-status" className="w-full">
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
                        Recalculado pelas candidaturas: Em processo quando alguma
                        está em {automationStatusList}; Descartada quando todas foram
                        encerradas. Blacklist é uma exceção manual e nunca é
                        sobrescrito.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </div>

              <div className="border-t border-border pt-6">
                <FieldSet>
                  <FieldLegend>Notas</FieldLegend>
                  <Field>
                    <FieldLabel htmlFor="edit-company-notes" className="sr-only">
                      Notas
                    </FieldLabel>
                    <Textarea
                      id="edit-company-notes"
                      name="notes"
                      defaultValue={values.notes}
                      placeholder="Sinais, impressões sobre cultura, ritmo de resposta, observações estratégicas."
                      className="min-h-28"
                    />
                  </Field>
                </FieldSet>
              </div>
            </form>

            {/* A separate form: it can't nest inside the edit form above. */}
            <form
              action={deleteAction}
              className="flex flex-col gap-3 border-t border-border pt-6"
            >
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Excluir empresa
                </h3>
                <p className="mt-1 text-[13px] text-pretty text-muted-foreground">
                  {canDelete
                    ? "Remove a empresa da base. Não dá para desfazer."
                    : "Disponível apenas quando não há candidaturas vinculadas."}
                </p>
              </div>
              <FormSubmitButton
                pendingLabel="Excluindo…"
                variant="destructive"
                className="w-full sm:w-auto sm:self-start"
                disabled={!canDelete}
              >
                Excluir empresa
              </FormSubmitButton>
            </form>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <SheetClose render={<Button type="button" variant="ghost" />}>
              Cancelar
            </SheetClose>
            <Button type="submit" form={EDIT_FORM_ID} disabled={isSaving}>
              {isSaving ? "Salvando…" : "Salvar ajustes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
