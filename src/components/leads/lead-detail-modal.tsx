"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { JobMarkdown } from "@/components/applications/job-markdown";
import { scoreClasses, useLeadDecisions } from "@/components/leads/lead-decisions";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import type { LeadListItem } from "@/components/leads/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getJobLeadUserDecisionLabel } from "@/lib/job-leads";
import { getSourceAttribution } from "@/lib/job-monitoring/sources/catalog";
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
        className="flex flex-col gap-0 p-0 sm:max-h-[90vh] sm:max-w-2xl"
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

  const attribution = getSourceAttribution(lead.sourceKind);
  const facts = [
    { label: "Senioridade", value: getSeniorityLabel(lead.seniority) ?? lead.seniority },
    { label: "Modelo", value: getWorkModelLabel(lead.workModel) ?? lead.workModel },
    { label: "Local", value: lead.locationText },
    { label: "Faixa salarial", value: lead.salaryText },
    { label: "Fonte", value: getSourceNameLabel(lead.sourceName) ?? "Outra origem" },
  ];

  return (
    <>
      <DialogHeader className="shrink-0 gap-3 border-b border-border px-4 pt-5 pr-14 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <LeadStatusBadge status={lead.classificationStatus} />
          {lead.classificationScore !== null ? (
            <span className="text-xs text-muted-foreground">
              Score{" "}
              <span className={cn("font-data font-medium", scoreClasses(lead.classificationScore).text)}>
                {lead.classificationScore}
              </span>
            </span>
          ) : null}
          {decisionLabel && lead.userDecision !== "none" ? (
            <span className="text-xs text-muted-foreground">{decisionLabel}</span>
          ) : null}
        </div>
        <div className="min-w-0">
          <DialogTitle className="text-lg leading-snug text-balance sm:text-xl">
            {lead.title}
          </DialogTitle>
          <DialogDescription className="mt-1 truncate text-sm">
            {lead.companyName}
          </DialogDescription>
        </div>
      </DialogHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-xs text-subtle-foreground">{fact.label}</dt>
                <dd
                  className={cn(
                    "mt-1 text-sm break-words text-foreground",
                    !fact.value && "text-subtle-foreground",
                  )}
                >
                  {fact.value || "Não informado"}
                </dd>
              </div>
            ))}
          </dl>

          {attribution ? (
            <p className="text-[13px] text-subtle-foreground">
              Vaga encontrada via{" "}
              <a
                href={lead.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-link underline-offset-4 hover:underline"
              >
                {attribution}
              </a>
              .
            </p>
          ) : null}

          <section className="flex flex-col gap-2 border-t border-border pt-5">
            <h3 className="text-[13px] font-medium text-muted-foreground">
              Por que o radar marcou assim
            </h3>
            <p className="max-w-[68ch] text-sm leading-6 text-pretty text-foreground">
              {lead.classificationReason || "Sem justificativa resumida."}
            </p>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-5">
            <h3 className="text-[13px] font-medium text-muted-foreground">Descrição da vaga</h3>
            <JobMarkdown
              content={lead.description || "Descrição indisponível para este lead."}
              className="max-w-[68ch] min-w-0 break-words"
            />
          </section>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
        <a
          href={lead.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir vaga original"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "shrink-0 px-2.5 max-sm:size-10 max-sm:px-0",
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
                disabled={isBusy}
                onClick={discard}
                className="flex-1 sm:flex-none"
              >
                {isDiscarding ? "Descartando…" : "Descartar"}
              </Button>
              <Button
                type="button"
                disabled={isBusy}
                onClick={approve}
                className="flex-1 sm:flex-none"
              >
                {isApproving ? "Aprovando…" : "Aprovar lead"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onCreateApplication(lead);
              }}
              className="flex-1 sm:flex-none"
            >
              Criar candidatura
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
