"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DefinitionItem } from "@/components/profile/profile-summary";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import {
  contractOptions,
  defaultAnswerFields,
  eligibilityOptions,
  emptySearchPreferences,
  jobFamilyOptions,
  targetSeniorityOptions,
  type DefaultAnswerKey,
  type SearchPreferences,
  type SearchPreferencesInput,
} from "@/lib/search-preferences";
import { saveSearchPreferencesAction } from "@/server/actions/search-preferences";

type SearchPreferencesPanelProps = {
  /** Null until the user saves once. */
  preferences: SearchPreferences | null;
  /** Read-only by default; "Editar" opens the form (one panel of the page at a time). */
  editing: boolean;
  /** A profile section is being edited: "Editar" waits for it. */
  locked?: boolean;
  onEditingChange: (editing: boolean) => void;
};

type FormState = {
  minMonthlyUsd: string;
  minAnnualUsd: string;
  acceptedContracts: string[];
  acceptedEligibility: string[];
  timezone: string;
  maxUtcOffsetDistanceHours: string;
  targetSeniorities: string[];
  targetJobFamilies: string[];
  titleIncludeKeywords: string;
  titleExcludeKeywords: string;
  defaultAnswers: Partial<Record<DefaultAnswerKey, string>>;
};

function toFormState(preferences: SearchPreferencesInput): FormState {
  return {
    minMonthlyUsd: preferences.minMonthlyUsd?.toString() ?? "",
    minAnnualUsd: preferences.minAnnualUsd?.toString() ?? "",
    acceptedContracts: preferences.acceptedContracts,
    acceptedEligibility: preferences.acceptedEligibility,
    timezone: preferences.timezone ?? "",
    maxUtcOffsetDistanceHours: preferences.maxUtcOffsetDistanceHours?.toString() ?? "",
    targetSeniorities: preferences.targetSeniorities,
    targetJobFamilies: preferences.targetJobFamilies,
    titleIncludeKeywords: preferences.titleIncludeKeywords.join(", "),
    titleExcludeKeywords: preferences.titleExcludeKeywords.join(", "),
    defaultAnswers: preferences.defaultAnswers,
  };
}

function toInput(state: FormState): SearchPreferencesInput {
  const toNumber = (value: string) => (value.trim() === "" ? null : Number(value));

  return {
    minMonthlyUsd: toNumber(state.minMonthlyUsd),
    minAnnualUsd: toNumber(state.minAnnualUsd),
    acceptedContracts: state.acceptedContracts as SearchPreferencesInput["acceptedContracts"],
    acceptedEligibility: state.acceptedEligibility as SearchPreferencesInput["acceptedEligibility"],
    timezone: state.timezone.trim() || null,
    maxUtcOffsetDistanceHours: toNumber(state.maxUtcOffsetDistanceHours),
    targetSeniorities: state.targetSeniorities as SearchPreferencesInput["targetSeniorities"],
    targetJobFamilies: state.targetJobFamilies as SearchPreferencesInput["targetJobFamilies"],
    titleIncludeKeywords: state.titleIncludeKeywords.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
    titleExcludeKeywords: state.titleExcludeKeywords.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
    defaultAnswers: state.defaultAnswers,
  };
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

const usd = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function labelsOf(options: ReadonlyArray<{ value: string; label: string }>, values: string[]) {
  return values
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .join(" · ");
}

function salaryFloorText(preferences: SearchPreferencesInput) {
  const parts = [
    preferences.minMonthlyUsd != null ? `US$ ${usd.format(preferences.minMonthlyUsd)}/mês` : null,
    preferences.minAnnualUsd != null ? `US$ ${usd.format(preferences.minAnnualUsd)}/ano` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

function timezoneText(preferences: SearchPreferencesInput) {
  const parts = [
    preferences.timezone,
    preferences.maxUtcOffsetDistanceHours != null
      ? `até ${preferences.maxUtcOffsetDistanceHours} h de diferença`
      : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

export function SearchPreferencesPanel({
  preferences,
  editing,
  locked = false,
  onEditingChange,
}: SearchPreferencesPanelProps) {
  const router = useRouter();
  const idPrefix = useId();
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const saved = preferences ?? emptySearchPreferences;
  const [state, setState] = useState<FormState>(() => toFormState(saved));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function startEditing() {
    setState(toFormState(saved));
    setError(null);
    onEditingChange(true);
  }

  function cancel() {
    setState(toFormState(saved));
    setError(null);
    onEditingChange(false);
  }

  function save() {
    setError(null);

    startSaving(async () => {
      const result = await saveSearchPreferencesAction(toInput(state));

      if (result.ok) {
        toast.success("Preferências de busca salvas");
        onEditingChange(false);
        router.refresh();
        return;
      }

      setError("Fuso horário inválido. Use um identificador IANA, como America/Sao_Paulo.");
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save();
  }

  const answeredDefaults = defaultAnswerFields.filter((answer) => saved.defaultAnswers[answer.key]?.trim());

  return (
    <Panel aria-labelledby="search-preferences-title" className="@container/panel overflow-hidden">
      <PanelHeader>
        <PanelTitle id="search-preferences-title">Busca internacional</PanelTitle>
        {editing ? (
          // Phones save and cancel from the pinned edit bar instead.
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            <Button disabled={isSaving} onClick={cancel} size="sm" type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={isSaving} onClick={save} size="sm" type="button">
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        ) : (
          <Button
            aria-label="Editar busca internacional"
            className="-mr-1.5 shrink-0"
            disabled={locked}
            onClick={startEditing}
            size="sm"
            type="button"
            variant="ghost"
          >
            Editar
          </Button>
        )}
      </PanelHeader>
      <PanelBody>
        <p className="mb-5 max-w-prose text-[13px] leading-5 text-muted-foreground">
          Critérios do radar para vagas remotas no exterior. Vagas que claramente fogem deles são
          descartadas antes de qualquer modelo de IA. Sem valor, o filtro correspondente fica
          desligado.
          {preferences?.updatedAt ? (
            <span className="text-subtle-foreground">
              {" "}
              Salvo em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(preferences.updatedAt)}.
            </span>
          ) : null}
        </p>

        {editing ? null : (
          <div className="flex flex-col gap-6">
            <dl className="grid gap-x-6 gap-y-4 @md/panel:grid-cols-2">
              <DefinitionItem label="Salário mínimo" value={salaryFloorText(saved)} />
              <DefinitionItem label="Fuso horário" value={timezoneText(saved)} />
              <DefinitionItem label="Contratos aceitos" value={labelsOf(contractOptions, saved.acceptedContracts)} />
              <DefinitionItem
                label="Elegibilidade geográfica"
                value={labelsOf(eligibilityOptions, saved.acceptedEligibility)}
              />
              <DefinitionItem
                label="Senioridade alvo"
                value={labelsOf(targetSeniorityOptions, saved.targetSeniorities)}
              />
              <DefinitionItem label="Famílias de vaga" value={labelsOf(jobFamilyOptions, saved.targetJobFamilies)} />
              <DefinitionItem label="Título deve ter" value={saved.titleIncludeKeywords.join(", ")} />
              <DefinitionItem label="Título descarta" value={saved.titleExcludeKeywords.join(", ")} />
            </dl>

            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-medium text-foreground">Respostas padrão de formulário</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Usadas no kit de candidatura. Perguntas demográficas (EEO) nunca são preenchidas.
              </p>
              {answeredDefaults.length > 0 ? (
                <dl className="mt-4 grid gap-x-6 gap-y-4 @md/panel:grid-cols-2">
                  {answeredDefaults.map((answer) => (
                    <DefinitionItem key={answer.key} label={answer.label} value={saved.defaultAnswers[answer.key] ?? null} />
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-[13px] text-subtle-foreground">Nenhuma resposta padrão definida.</p>
              )}
            </div>
          </div>
        )}

        {editing ? (
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor={fieldId("monthly")}>Mínimo mensal (US$)</FieldLabel>
                <Input
                  id={fieldId("monthly")}
                  inputMode="numeric"
                  min={0}
                  onChange={(event) => update("minMonthlyUsd", event.target.value)}
                  type="number"
                  value={state.minMonthlyUsd}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("annual")}>Mínimo anual (US$)</FieldLabel>
                <Input
                  id={fieldId("annual")}
                  inputMode="numeric"
                  min={0}
                  onChange={(event) => update("minAnnualUsd", event.target.value)}
                  type="number"
                  value={state.minAnnualUsd}
                />
              </Field>
              <FieldDescription className="sm:pt-6">
                Só compara salários publicados em dólar. Mensal × 12 e anual valem juntos; vale o
                menor piso.
              </FieldDescription>
            </div>

            <ToggleGroup
              label="Contratos aceitos"
              onToggle={(value) => update("acceptedContracts", toggle(state.acceptedContracts, value))}
              options={contractOptions}
              selected={state.acceptedContracts}
            />

            <ToggleGroup
              description="Onde a vaga pode ser exercida. Vagas restritas a outra região são descartadas."
              label="Elegibilidade geográfica"
              onToggle={(value) =>
                update("acceptedEligibility", toggle(state.acceptedEligibility, value))
              }
              options={eligibilityOptions}
              selected={state.acceptedEligibility}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={fieldId("timezone")}>Fuso horário</FieldLabel>
                <Input
                  autoComplete="off"
                  id={fieldId("timezone")}
                  onChange={(event) => update("timezone", event.target.value)}
                  placeholder="America/Sao_Paulo"
                  value={state.timezone}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("offset")}>Distância máxima de fuso (horas)</FieldLabel>
                <Input
                  id={fieldId("offset")}
                  inputMode="numeric"
                  max={12}
                  min={0}
                  onChange={(event) => update("maxUtcOffsetDistanceHours", event.target.value)}
                  type="number"
                  value={state.maxUtcOffsetDistanceHours}
                />
              </Field>
            </div>
            {error ? <FieldError>{error}</FieldError> : null}

            <ToggleGroup
              label="Senioridade alvo"
              onToggle={(value) => update("targetSeniorities", toggle(state.targetSeniorities, value))}
              options={targetSeniorityOptions}
              selected={state.targetSeniorities}
            />

            <ToggleGroup
              description="Famílias de vaga que interessam. O título precisa combinar com alguma delas ou com as palavras abaixo."
              label="Famílias de vaga"
              onToggle={(value) => update("targetJobFamilies", toggle(state.targetJobFamilies, value))}
              options={jobFamilyOptions}
              selected={state.targetJobFamilies}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={fieldId("include")}>Palavras que o título deve ter</FieldLabel>
                <Textarea
                  id={fieldId("include")}
                  onChange={(event) => update("titleIncludeKeywords", event.target.value)}
                  placeholder="engineer, developer, backend"
                  value={state.titleIncludeKeywords}
                />
                <FieldDescription>Separe por vírgula. Basta uma delas.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={fieldId("exclude")}>Palavras que descartam o título</FieldLabel>
                <Textarea
                  id={fieldId("exclude")}
                  onChange={(event) => update("titleExcludeKeywords", event.target.value)}
                  placeholder="intern, sales, recruiter"
                  value={state.titleExcludeKeywords}
                />
                <FieldDescription>Separe por vírgula.</FieldDescription>
              </Field>
            </div>
          </FieldGroup>

          <FieldSet>
            <FieldLegend>Respostas padrão de formulário</FieldLegend>
            <FieldDescription>
              Usadas no kit de candidatura. Perguntas demográficas (EEO) nunca são preenchidas.
            </FieldDescription>
            <div className="grid gap-4 sm:grid-cols-2">
              {defaultAnswerFields.map((answer) => (
                <Field key={answer.key}>
                  <FieldLabel htmlFor={fieldId(answer.key)}>{answer.label}</FieldLabel>
                  <Input
                    id={fieldId(answer.key)}
                    maxLength={300}
                    onChange={(event) =>
                      update("defaultAnswers", {
                        ...state.defaultAnswers,
                        [answer.key]: event.target.value,
                      })
                    }
                    placeholder={answer.placeholder}
                    value={state.defaultAnswers[answer.key] ?? ""}
                  />
                </Field>
              ))}
            </div>
          </FieldSet>
        </form>
        ) : null}
      </PanelBody>

      {/* Phones: same pinned save/cancel bar as the profile sections. */}
      {editing ? (
        <div className="fixed inset-x-0 bottom-0 z-(--z-action-bar) animate-in border-t border-border bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] duration-200 fade-in-0 slide-in-from-bottom-3 md:hidden">
          <p className="mb-2 text-xs text-subtle-foreground">Editando busca internacional</p>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isSaving} onClick={cancel} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={isSaving} onClick={save} type="button">
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function ToggleGroup({
  label,
  description,
  options,
  selected,
  onToggle,
}: {
  label: string;
  description?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label">{label}</FieldLegend>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <SegmentedControl className="h-auto flex-wrap" aria-label={label}>
        {options.map((option) => (
          <SegmentedControlItem
            className="h-7 pointer-coarse:h-9"
            key={option.value}
            onClick={() => onToggle(option.value)}
            pressed={selected.includes(option.value)}
          >
            {option.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </FieldSet>
  );
}
