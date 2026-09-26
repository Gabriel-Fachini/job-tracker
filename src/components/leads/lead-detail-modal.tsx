"use client";

import { useState } from "react";
import { BriefcaseBusiness, Building2, ExternalLink } from "lucide-react";

import { JobMarkdown } from "@/components/applications/job-markdown";
import { scoreTone, useLeadDecisions } from "@/components/leads/lead-decisions";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import type { LeadListItem } from "@/components/leads/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getJobLeadUserDecisionLabel } from "@/lib/job-leads";
import { getSeniorityLabel, getSourceNameLabel, getWorkModelLabel } from "@/lib/jobs";
import { cn } from "@/lib/utils";

type LeadDetailModalProps = {
  lead: LeadListItem | null;
  onClose: () => void;
  onCreateApplication: (lead: LeadListItem) => void;
};

export function LeadDetailModal({
  lead,
  onClose,
  onCreateApplication,
}: LeadDetailModalProps) {
  // Keep the last lead on screen while the sheet animates closed.
  const [renderedLead, setRenderedLead] = useState(lead);
  if (lead && lead !== renderedLead) {
    setRenderedLead(lead);
  }

  if (!renderedLead) {
    return null;
  }

  return (
    <Dialog open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        sheetSize="full"
        className="flex flex-col gap-0 p-0 sm:max-h-[92vh] sm:max-w-3xl"
      >
        <LeadDetailBody
          key={renderedLead.id}
          lead={renderedLead}
          onClose={onClose}
          onCreateApplication={onCreateApplication}
        />
      </DialogContent>
    </Dialog>
  );
}

function LeadDetailBody({
  lead,
  onClose,
  onCreateApplication,
}: {
  lead: LeadListItem;
  onClose: () => void;
  onCreateApplication: (lead: LeadListItem) => void;
}) {
  const { approve, discard, isApproving, isDiscarding } = useLeadDecisions(
    lead.id,
    onClose,
  );
  const isTriage = lead.userDecision === "none";
  const decisionLabel = getJobLeadUserDecisionLabel(lead.userDecision);
  const isBusy = isApproving || isDiscarding;

  const facts = [
    { label: "Senioridade", value: getSeniorityLabel(lead.seniority) ?? lead.seniority },
    { label: "Modelo", value: getWorkModelLabel(lead.workModel) ?? lead.workModel },
    { label: "Local", value: lead.locationText },
    { label: "Faixa salarial", value: lead.salaryText },
    { label: "Fonte", value: getSourceNameLabel(lead.sourceName) ?? "Outra origem" },
  ];

  return (
    <>
      <DialogHeader className="shrink-0 gap-3 border-b border-border/50 px-4 pt-5 pr-14 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <LeadStatusBadge status={lead.classificationStatus} />
          {lead.classificationScore !== null ? (
            <Chip tone={scoreTone(lead.classificationScore)} className="tabular-nums">
              Score {lead.classificationScore}
            </Chip>
          ) : null}
          {decisionLabel && lead.userDecision !== "none" ? (
            <Chip tone="muted">{decisionLabel}</Chip>
          ) : null}
        </div>
        <div className="min-w-0">
          <DialogTitle className="text-xl leading-tight text-balance sm:text-2xl">
            {lead.title}
          </DialogTitle>
          <DialogDescription className="mt-2 flex items-center gap-1.5 text-sm">
            <Building2 aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{lead.companyName}</span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-sm font-medium break-words text-foreground",
                    !fact.value && "font-normal text-muted-foreground",
                  )}
                >
                  {fact.value || "Não informado"}
                </dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Por que o radar marcou assim
            </h3>
            <p className="text-sm leading-6 text-pretty text-muted-foreground">
              {lead.classificationReason || "Sem justificativa resumida."}
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Descrição da vaga</h3>
            <JobMarkdown
              content={lead.description || "Descrição indisponível para este lead."}
              className="min-w-0 break-words"
            />
          </section>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        <a
          href={lead.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir vaga original"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-lg" }),
            "shrink-0 rounded-xl sm:w-auto sm:px-3",
          )}
        >
          <ExternalLink />
          <span className="hidden sm:inline">Abrir vaga</span>
        </a>

        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          {isTriage ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isBusy}
                onClick={discard}
                className="flex-1 rounded-xl sm:flex-none"
              >
                {isDiscarding ? "Descartando…" : "Descartar"}
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={isBusy}
                onClick={approve}
                className="flex-1 rounded-xl sm:flex-none"
              >
                <BriefcaseBusiness data-icon="inline-start" />
                {isApproving ? "Aprovando…" : "Aprovar lead"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => {
                onClose();
                onCreateApplication(lead);
              }}
              className="flex-1 rounded-xl sm:flex-none"
            >
              <BriefcaseBusiness data-icon="inline-start" />
              Criar candidatura
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
