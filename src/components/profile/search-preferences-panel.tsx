"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Panel, PanelBody, PanelHeader, PanelMeta, PanelTitle } from "@/components/ui/panel";
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

export function SearchPreferencesPanel({ preferences }: SearchPreferencesPanelProps) {
  const idPrefix = useId();
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const [state, setState] = useState<FormState>(() =>
    toFormState(preferences ?? emptySearchPreferences),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startSaving(async () => {
      const result = await saveSearchPreferencesAction(toInput(state));

      if (result.ok) {
        toast.success("Preferências de busca salvas");
        return;
      }

      setError("Fuso horário inválido. Use um identificador IANA, como America/Sao_Paulo.");
    });
  }

  return (
    <Panel aria-labelledby="search-preferences-title">
      <PanelHeader>
        <PanelTitle id="search-preferences-title">Busca internacional</PanelTitle>
        <PanelMeta>
          {preferences?.updatedAt
            ? `Salvo em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(preferences.updatedAt)}`
            : "Filtros desligados"}
        </PanelMeta>
      </PanelHeader>
      <PanelBody>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <p className="max-w-prose text-[13px] leading-5 text-muted-foreground">
            Critérios do radar para vagas remotas no exterior. Vagas que claramente fogem deles são
            descartadas antes de qualquer modelo de IA. Sem valores preenchidos, o filtro
            correspondente fica desligado.
          </p>

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

          <div className="flex justify-end">
            {/* The page's single primary action is "Editar perfil"; this one stays outlined. */}
            <Button disabled={isSaving} type="submit" variant="outline">
              {isSaving ? "Salvando..." : "Salvar busca internacional"}
            </Button>
          </div>
        </form>
      </PanelBody>
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
