import Link from "next/link";
import { Building2, Orbit, Radar, ShieldBan } from "lucide-react";

import {
  companyAutomationStatusLabels,
  companyJobBoardNavigationModeOptions,
  companySizeOptions,
  companyStatusOptions,
} from "@/lib/companies";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
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
import { cn } from "@/lib/utils";
import { FormSubmitButton } from "@/components/companies/form-submit-button";

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
  status: string;
  notes: string;
};

type CompanyFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  description: string;
  submitLabel: string;
  submitPendingLabel: string;
  title: string;
  values: CompanyFormValues;
};

const inputClassName =
  "h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const textareaClassName =
  "min-h-36 rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CompanyForm({
  action,
  cancelHref,
  description,
  submitLabel,
  submitPendingLabel,
  title,
  values,
}: CompanyFormProps) {
  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_320px]">
      <Card className="overflow-hidden border-border/60 bg-card/85 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <CardHeader className="border-b border-border/40 pb-5">
          <CardTitle className="font-heading text-2xl text-balance">
            {title}
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-8 pt-6">
          <FieldSet>
            <FieldLegend>Identidade da empresa</FieldLegend>
            <FieldDescription>
              Cadastre a empresa como uma base local de acompanhamento. O
              vínculo com candidaturas acontece automaticamente quando houver
              nome compatível ou ligação já salva no banco.
            </FieldDescription>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="company-name">Nome *</FieldLabel>
                <Input
                  id="company-name"
                  name="name"
                  required
                  defaultValue={values.name}
                  placeholder="Ex.: Nubank"
                  className={inputClassName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-sector">Setor</FieldLabel>
                <Input
                  id="company-sector"
                  name="sector"
                  defaultValue={values.sector}
                  placeholder="Ex.: Fintech, SaaS B2B, Healthtech"
                  className={inputClassName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-website">Site</FieldLabel>
                <Input
                  id="company-website"
                  name="website"
                  type="url"
                  defaultValue={values.website}
                  placeholder="https://empresa.com"
                  className={inputClassName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-size">Porte</FieldLabel>
                <Select defaultValue={values.size || undefined} name="size">
                  <SelectTrigger className="h-11 w-full rounded-xl">
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
            <FieldDescription>
              O status pode ser ajustado manualmente, mas empresas ligadas a
              candidaturas ativas são recalculadas automaticamente para refletir
              o funil real.
            </FieldDescription>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="company-jobs-board">Job board</FieldLabel>
                <Input
                  id="company-jobs-board"
                  name="jobsBoardUrl"
                  type="url"
                  defaultValue={values.jobsBoardUrl}
                  placeholder="https://careers.empresa.com"
                  className={inputClassName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-glassdoor">Glassdoor</FieldLabel>
                <Input
                  id="company-glassdoor"
                  name="glassdoorUrl"
                  type="url"
                  defaultValue={values.glassdoorUrl}
                  placeholder="https://www.glassdoor.com/..."
                  className={inputClassName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-job-board-navigation">
                  Navegação do job board
                </FieldLabel>
                <Select
                  defaultValue={values.jobBoardNavigationMode || "fetch"}
                  name="jobBoardNavigationMode"
                >
                  <SelectTrigger
                    className="h-11 w-full rounded-xl"
                    id="company-job-board-navigation"
                  >
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
                  paginação client-side ou conteúdo invisível ao fetch simples.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="company-ats-provider">
                  Provedor de ATS
                </FieldLabel>
                <Select
                  defaultValue={values.atsProvider || "auto"}
                  name="atsProvider"
                >
                  <SelectTrigger
                    className="h-11 w-full rounded-xl"
                    id="company-ats-provider"
                  >
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="auto">Detectar automaticamente</SelectItem>
                      <SelectItem value="greenhouse">Greenhouse</SelectItem>
                      <SelectItem value="gupy">Gupy</SelectItem>
                      <SelectItem value="inhire">InHire</SelectItem>
                      <SelectItem value="generic">Genérico (HTML)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  "Detectar automaticamente" identifica o provedor pela URL.
                  Use outro valor para override manual.
                </FieldDescription>
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="company-status">Status da empresa</FieldLabel>
                <Select defaultValue={values.status || "monitoring"} name="status">
                  <SelectTrigger className="h-11 w-full rounded-xl" id="company-status">
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
                  `Em processo` costuma ser aplicado automaticamente quando a
                  empresa tem candidaturas em {companyAutomationStatusLabels.join(", ")}.
                  `Blacklist` funciona como exceção manual e não é sobrescrito.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>

          <Field>
            <FieldLabel htmlFor="company-notes">Notas</FieldLabel>
            <Textarea
              id="company-notes"
              name="notes"
              defaultValue={values.notes}
              placeholder="Anote sinais, impressões sobre cultura, ritmo de resposta e observações estratégicas."
              className={textareaClassName}
            />
          </Field>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t border-border/40 bg-background/20 px-6 py-5 sm:flex-row sm:justify-end">
          <Link
            href={cancelHref}
            className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
          >
            Cancelar
          </Link>
          <FormSubmitButton
            pendingLabel={submitPendingLabel}
            className="w-full sm:w-auto"
          >
            {submitLabel}
          </FormSubmitButton>
        </CardFooter>
      </Card>

      <div className="grid gap-4">
        <Card className="border-emerald-400/20 bg-emerald-400/6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-100">
              <Orbit className="text-emerald-300/80" />
              Relação viva com candidaturas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-emerald-50/80">
            Sempre que uma candidatura associada mudar de status, a empresa pode
            migrar sozinha entre monitoramento, processo ativo e descarte.
          </CardContent>
        </Card>

        <Card className="border-sky-400/20 bg-sky-400/6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-sky-100">
              <Radar className="text-sky-300/80" />
              Foco de uso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-sky-50/80">
            Este módulo existe para concentrar empresas relevantes mesmo antes
            de haver vaga aberta, evitando perder contexto entre um processo e outro.
          </CardContent>
        </Card>

        <Card className="border-rose-400/20 bg-rose-400/6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-rose-100">
              <ShieldBan className="text-rose-300/80" />
              Exceção manual
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-rose-50/80">
            `Blacklist` é tratado como decisão manual forte. Mesmo com
            candidaturas históricas vinculadas, o sync automático não reabre
            esse status.
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="text-muted-foreground" />
              Escopo desta fase
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Fase 3 entrega o CRUD de empresas e a ligação com as candidaturas
            já existentes. A refatoração maior do modelo de candidatura ainda
            continua pertencendo à Fase 4.
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
