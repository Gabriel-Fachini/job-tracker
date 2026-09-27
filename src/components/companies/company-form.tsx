import Link from "next/link";

import { FormSubmitButton } from "@/components/companies/form-submit-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  companyAutomationStatusLabels,
  companyJobBoardNavigationModeOptions,
  companySizeOptions,
  companyStatusOptions,
} from "@/lib/companies";

export type CompanyFormValues = {
  name: string;
  website: string;
  sector: string;
  size: string;
  jobsBoardUrl: string;
  jobBoardNavigationMode: string;
  atsProvider?: string;
  atsBoardToken?: string;
  glassdoorUrl: string;
  logoUrl: string;
  status: string;
  notes: string;
};

type CompanyFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  submitLabel: string;
  submitPendingLabel: string;
  values: CompanyFormValues;
};

export const atsProviderOptions = [
  { value: "auto", label: "Detectar automaticamente" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "gupy", label: "Gupy" },
  { value: "inhire", label: "InHire" },
  { value: "generic", label: "Genérico (HTML)" },
] as const;

/** "Aplicada, Em processo, Oferta ou Aprovada", for the status descriptions. */
export const automationStatusList = new Intl.ListFormat("pt-BR", {
  type: "disjunction",
}).format(companyAutomationStatusLabels);

/** The status field's help text, shared by the create form and the edit sheet. */
export const companyStatusHelp = `Fica como você escolher. Só muda sozinho quando uma candidatura desta empresa é criada ou muda de status: Em processo se alguma está em ${automationStatusList}; Descartada quando todas foram encerradas. Blacklist nunca é sobrescrito.`;

export function CompanyForm({
  action,
  cancelHref,
  submitLabel,
  submitPendingLabel,
  values,
}: CompanyFormProps) {
  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      <FieldSet>
        <FieldLegend>Identidade</FieldLegend>
        <FieldGroup className="grid gap-x-4 gap-y-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="company-name">Nome *</FieldLabel>
            <Input
              id="company-name"
              name="name"
              required
              defaultValue={values.name}
              placeholder="Ex.: Nimbus Pagamentos"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="company-sector">Setor</FieldLabel>
            <Input
              id="company-sector"
              name="sector"
              defaultValue={values.sector}
              placeholder="Ex.: Fintech, SaaS B2B, Healthtech"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="company-website">Site</FieldLabel>
            <Input
              id="company-website"
              name="website"
              type="url"
              inputMode="url"
              autoComplete="url"
              defaultValue={values.website}
              placeholder="https://empresa.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="company-size">Porte</FieldLabel>
            <Select items={companySizeOptions} defaultValue={values.size || undefined} name="size">
              <SelectTrigger id="company-size" className="w-full">
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
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="company-logo">Logo</FieldLabel>
            <Input
              id="company-logo"
              name="logoUrl"
              type="url"
              inputMode="url"
              defaultValue={values.logoUrl}
              placeholder="https://empresa.com/logo.png"
            />
            <FieldDescription>
              Opcional. Em branco, o logo vem do ícone do site.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>

      {/* Hairlines live on wrappers: a border on the fieldset itself would be
          drawn through its legend. */}
      <div className="border-t border-border pt-6">
        <FieldSet>
          <FieldLegend>Board e status</FieldLegend>
          <FieldGroup className="grid gap-x-4 gap-y-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="company-jobs-board">Job board</FieldLabel>
              <Input
                id="company-jobs-board"
                name="jobsBoardUrl"
                type="url"
                inputMode="url"
                defaultValue={values.jobsBoardUrl}
                placeholder="https://careers.empresa.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="company-glassdoor">Glassdoor</FieldLabel>
              <Input
                id="company-glassdoor"
                name="glassdoorUrl"
                type="url"
                inputMode="url"
                defaultValue={values.glassdoorUrl}
                placeholder="https://www.glassdoor.com/..."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="company-job-board-navigation">
                Navegação do job board
              </FieldLabel>
              <Select
                items={companyJobBoardNavigationModeOptions}
                defaultValue={values.jobBoardNavigationMode || "fetch"}
                name="jobBoardNavigationMode"
              >
                <SelectTrigger id="company-job-board-navigation" className="w-full">
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
                client-side ou de conteúdo invisível ao fetch simples.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="company-ats-provider">Provedor de ATS</FieldLabel>
              <Select
                items={atsProviderOptions}
                defaultValue={values.atsProvider || "auto"}
                name="atsProvider"
              >
                <SelectTrigger id="company-ats-provider" className="w-full">
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
                “Detectar automaticamente” identifica o provedor pela URL. Escolha
                outro valor para forçar um provedor.
              </FieldDescription>
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="company-status">Status da empresa</FieldLabel>
              <Select
                items={companyStatusOptions}
                defaultValue={values.status || "monitoring"}
                name="status"
              >
                <SelectTrigger id="company-status" className="w-full">
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
            <FieldLabel htmlFor="company-notes" className="sr-only">
              Notas
            </FieldLabel>
            <Textarea
              id="company-notes"
              name="notes"
              defaultValue={values.notes}
              placeholder="Anote sinais, impressões sobre cultura, ritmo de resposta e observações estratégicas."
              className="min-h-28"
            />
          </Field>
        </FieldSet>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-6 sm:flex sm:justify-end">
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
        <FormSubmitButton pendingLabel={submitPendingLabel}>{submitLabel}</FormSubmitButton>
      </div>
    </form>
  );
}
