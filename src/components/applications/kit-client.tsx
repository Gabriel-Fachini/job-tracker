"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelBody, PanelHeader, PanelMeta, PanelTitle } from "@/components/ui/panel";
import { Tag, type TagColor } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { countWords } from "@/lib/apply/cover-letter-words";
import type { AnswerSource, FormField, KitAnswer, KitAnswers, KitStatus } from "@/lib/apply/types";
import { cn } from "@/lib/utils";
import {
  markKitSubmittedAction,
  prepareApplicationKitAction,
  updateKitAnswerAction,
  updateKitCoverLetterAction,
} from "@/server/actions/kit";

export type KitClientData = {
  applicationId: number;
  jobTitle: string;
  companyName: string;
  applicationStatus: string;
  kit: {
    applyUrl: string | null;
    status: KitStatus;
    hasResume: boolean;
    coverLetter: string | null;
    fields: FormField[];
    answers: KitAnswers;
    updatedAt: string;
  } | null;
};

const statusTag: Record<KitStatus, { label: string; color: TagColor }> = {
  draft: { label: "Rascunho", color: "gray" },
  ready: { label: "Pronto", color: "green" },
  submitted_by_user: { label: "Enviada por você", color: "blue" },
};

const sourceTag: Record<AnswerSource, { label: string; color: TagColor } | null> = {
  profile: { label: "perfil", color: "gray" },
  preferences: { label: "preferências", color: "blue" },
  cover_letter: { label: "cover letter", color: "gray" },
  resume: { label: "currículo", color: "gray" },
  ai_draft: { label: "rascunho IA", color: "orange" },
  manual: { label: "editado por você", color: "green" },
  none: null,
};

const prepareErrors: Record<string, string> = {
  "not-found": "Candidatura não encontrada.",
  "no-profile": "Configure o perfil antes de preparar a candidatura.",
  "no-description": "A vaga não tem descrição. Adicione uma para gerar o currículo e a cover letter.",
  failed: "Não foi possível preparar o kit.",
};

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado`);
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
  }
}

export function KitClient({ data }: { data: KitClientData }) {
  const router = useRouter();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isPreparing, startPreparing] = useTransition();
  const [isMarking, startMarking] = useTransition();
  const kit = data.kit;
  const submitted = kit?.status === "submitted_by_user";

  function handlePrepare() {
    setWarnings([]);

    startPreparing(async () => {
      const result = await prepareApplicationKitAction(data.applicationId);

      if (!result.ok) {
        toast.error(result.message ?? prepareErrors[result.error] ?? prepareErrors.failed);
        return;
      }

      setWarnings(result.warnings);
      toast.success(result.warnings.length > 0 ? "Kit preparado, com avisos" : "Kit preparado");
      router.refresh();
    });
  }

  function handleMarkSubmitted() {
    startMarking(async () => {
      const result = await markKitSubmittedAction(data.applicationId);

      if (!result.ok) {
        toast.error("Não foi possível atualizar a candidatura.");
        return;
      }

      toast.success("Candidatura marcada como enviada");
      router.refresh();
    });
  }

  const command =
    typeof window === "undefined"
      ? ""
      : `npm run apply:fill -- --app-url ${window.location.origin} --application ${data.applicationId}`;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Panel>
        <PanelBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {kit ? (
              <Tag variant="status" color={statusTag[kit.status].color}>
                {statusTag[kit.status].label}
              </Tag>
            ) : (
              <Tag variant="status" color="muted">
                Não preparado
              </Tag>
            )}
            <p className="text-[13px] text-muted-foreground">
              {kit
                ? "Copie as respostas ou preencha o formulário no seu computador. O app nunca envia nada por você."
                : "Gera o currículo em inglês, a cover letter e as respostas do formulário."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {kit?.applyUrl ? (
              <a
                className={buttonVariants({ variant: "outline" })}
                href={kit.applyUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir formulário
                <ExternalLink data-icon="inline-end" />
              </a>
            ) : null}
            <Button
              disabled={isPreparing}
              onClick={handlePrepare}
              type="button"
              // The kit's main action is one purple button at a time.
              variant={kit ? "outline" : "default"}
            >
              {isPreparing ? <Loader2 className="motion-safe:animate-spin" data-icon="inline-start" /> : null}
              {isPreparing ? "Preparando…" : kit ? "Preparar de novo" : "Preparar candidatura"}
            </Button>
            {kit && !submitted ? (
              <Button disabled={isMarking} onClick={handleMarkSubmitted} type="button">
                <Check data-icon="inline-start" />
                {isMarking ? "Salvando…" : "Marquei como enviada"}
              </Button>
            ) : null}
          </div>
        </PanelBody>
      </Panel>

      {warnings.length > 0 ? (
        <div className="flex flex-col gap-2">
          {warnings.map((warning) => (
            <Notice bordered key={warning} tone="caution">
              {warning}
            </Notice>
          ))}
        </div>
      ) : null}

      {kit ? (
        <>
          <ResumePanel applicationId={data.applicationId} hasResume={kit.hasResume} />
          <CoverLetterPanel applicationId={data.applicationId} initial={kit.coverLetter} key={kit.updatedAt} />
          <FieldsPanel
            answers={kit.answers}
            applicationId={data.applicationId}
            applyUrl={kit.applyUrl}
            fields={kit.fields}
            key={`${kit.updatedAt}-fields`}
          />
          <Panel>
            <PanelHeader>
              <PanelTitle>Preencher no seu computador</PanelTitle>
            </PanelHeader>
            <PanelBody className="flex flex-col gap-3">
              <p className="max-w-prose text-[13px] leading-5 text-muted-foreground">
                O script abre o formulário num navegador da sua máquina (a VPS não tem tela), preenche os campos
                mapeados, anexa o currículo, destaca o que ficou sem resposta e <strong>para antes de enviar</strong>:
                ele nunca clica em enviar. Se aparecer login ou CAPTCHA, ele para de preencher e avisa no terminal.
              </p>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 rounded-lg border border-border bg-field px-3 py-2 font-data text-xs break-all text-foreground">
                  {command || `npm run apply:fill -- --app-url <URL do app> --application ${data.applicationId}`}
                </code>
                <Button
                  aria-label="Copiar comando"
                  onClick={() => copyText(command, "Comando")}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <Copy />
                </Button>
              </div>
            </PanelBody>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function ResumePanel({ applicationId, hasResume }: { applicationId: number; hasResume: boolean }) {
  const href = `/api/applications/${applicationId}/kit/resume`;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Currículo em inglês</PanelTitle>
      </PanelHeader>
      <PanelBody className="flex flex-col gap-3">
        {hasResume ? (
          <>
            <div className="flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: "outline" })} href={href} rel="noreferrer" target="_blank">
                Abrir PDF
                <ExternalLink data-icon="inline-end" />
              </a>
              <a className={buttonVariants({ variant: "outline" })} href={`${href}?download=1`}>
                <Download data-icon="inline-start" />
                Baixar PDF
              </a>
            </div>
            <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
              <iframe className="block w-full" src={href} style={{ height: "min(640px, 60vh)" }} title="Prévia do currículo em inglês" />
            </div>
          </>
        ) : (
          <Notice tone="caution">
            O currículo em inglês não foi gerado. Confira se o <code className="font-data">tectonic</code> está no PATH e
            tente preparar de novo.
          </Notice>
        )}
      </PanelBody>
    </Panel>
  );
}

function CoverLetterPanel({ applicationId, initial }: { applicationId: number; initial: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(initial ?? "");
  const [isSaving, startSaving] = useTransition();
  const dirty = text.trim() !== (initial ?? "").trim();
  const words = countWords(text);

  function handleSave() {
    startSaving(async () => {
      const result = await updateKitCoverLetterAction(applicationId, text);

      if (!result.ok) {
        toast.error("Não foi possível salvar a cover letter.");
        return;
      }

      toast.success("Cover letter salva");
      router.refresh();
    });
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Cover letter</PanelTitle>
        <PanelMeta>
          <span className="font-data">{words}</span> palavras
        </PanelMeta>
      </PanelHeader>
      <PanelBody className="flex flex-col gap-3">
        {initial ? null : (
          <Notice tone="caution">A cover letter não foi gerada. Prepare de novo ou escreva a sua aqui.</Notice>
        )}
        <Textarea
          aria-label="Cover letter"
          className="min-h-56"
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={!text.trim()} onClick={() => copyText(text, "Cover letter")} type="button" variant="outline">
            <Copy data-icon="inline-start" />
            Copiar
          </Button>
          <Button disabled={!dirty || isSaving} onClick={handleSave} type="button" variant="outline">
            {isSaving ? "Salvando…" : "Salvar edição"}
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

function FieldsPanel({
  applicationId,
  applyUrl,
  fields,
  answers,
}: {
  applicationId: number;
  applyUrl: string | null;
  fields: FormField[];
  answers: KitAnswers;
}) {
  const unanswered = fields.filter((field) => !field.eeo && answers[field.id]?.key !== "eeo_demographic" && !answers[field.id]?.value).length;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Campos do formulário</PanelTitle>
        <PanelMeta>
          <span className="font-data">{fields.length}</span> campos
          {unanswered > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-data">{unanswered}</span> sem resposta
            </>
          ) : null}
        </PanelMeta>
      </PanelHeader>
      {fields.length === 0 ? (
        <PanelBody>
          <Notice>
            Nenhum campo foi lido{applyUrl ? "" : " (a vaga não tem link de candidatura)"}. Abra o formulário, use a
            cover letter e o currículo acima e preencha à mão.
          </Notice>
        </PanelBody>
      ) : (
        <ul className="divide-y divide-border">
          {fields.map((field) => (
            <FieldRow answer={answers[field.id]} applicationId={applicationId} field={field} key={field.id} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function FieldRow({ applicationId, field, answer }: { applicationId: number; field: FormField; answer: KitAnswer | undefined }) {
  const router = useRouter();
  const [value, setValue] = useState(answer?.value ?? "");
  const [isSaving, startSaving] = useTransition();
  const isEeo = Boolean(field.eeo) || answer?.key === "eeo_demographic";
  const dirty = value.trim() !== (answer?.value ?? "").trim();
  const source = answer ? sourceTag[answer.source] : null;
  const isLong = field.type === "textarea" || (answer?.value?.length ?? 0) > 90;
  const isFile = field.type === "file";

  function handleSave() {
    startSaving(async () => {
      const result = await updateKitAnswerAction(applicationId, field.id, value);

      if (!result.ok) {
        toast.error("Não foi possível salvar esta resposta.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="min-w-0 text-[13px] font-medium break-words text-foreground">{field.label}</h3>
        {field.required ? <Tag color="muted">obrigatório</Tag> : null}
        {source ? <Tag color={source.color}>{source.label}</Tag> : null}
      </div>

      {isEeo ? (
        <p className="text-[13px] text-subtle-foreground">Pergunta demográfica: responda você mesmo, o app não preenche.</p>
      ) : isFile ? (
        <p className="text-[13px] text-muted-foreground">
          {answer?.value ? "Anexe o PDF do currículo em inglês deste kit (botão Baixar PDF acima)." : (answer?.note ?? "Anexe o arquivo à mão.")}
        </p>
      ) : (
        <>
          {isLong ? (
            <Textarea
              aria-label={field.label}
              className={cn("min-h-24", answer?.aiDraft && "border-tag-orange-foreground/40")}
              onChange={(event) => setValue(event.target.value)}
              value={value}
            />
          ) : (
            <Input aria-label={field.label} onChange={(event) => setValue(event.target.value)} value={value} />
          )}
          {answer?.note && !value ? <p className="text-xs text-subtle-foreground">{answer.note}</p> : null}
          {answer?.aiDraft ? <p className="text-xs text-caution">Rascunho gerado por IA: revise antes de enviar.</p> : null}
          {field.options && field.options.length > 0 ? (
            <p className="text-xs break-words text-subtle-foreground">Opções: {field.options.slice(0, 12).join(" · ")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!value.trim()} onClick={() => copyText(value, "Resposta")} size="sm" type="button" variant="outline">
              <Copy data-icon="inline-start" />
              Copiar
            </Button>
            {dirty ? (
              <Button disabled={isSaving} onClick={handleSave} size="sm" type="button" variant="ghost">
                {isSaving ? "Salvando…" : "Salvar"}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </li>
  );
}
