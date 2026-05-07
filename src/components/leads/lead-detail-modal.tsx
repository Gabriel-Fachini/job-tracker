"use client";

import { Building2, ExternalLink, MapPin, Radar, Sparkles, Wallet } from "lucide-react";

import { JobMarkdown } from "@/components/applications/job-markdown";
import { FormSubmitButton } from "@/components/companies/form-submit-button";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import type { LeadListItem, LeadTab } from "@/components/leads/types";
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
import { cn } from "@/lib/utils";
import { approveLead, discardLead } from "@/server/actions/job-monitoring";

type LeadDetailModalProps = {
  lead: LeadListItem | null;
  tab: LeadTab;
  onClose: () => void;
  onCreateApplication: (lead: LeadListItem) => void;
};

export function LeadDetailModal({
  lead,
  tab,
  onClose,
  onCreateApplication,
}: LeadDetailModalProps) {
  if (!lead) {
    return null;
  }

  const approveAction = approveLead.bind(null, lead.id);
  const discardAction = discardLead.bind(null, lead.id);
  const decisionLabel = getJobLeadUserDecisionLabel(lead.userDecision);

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border/50 px-6 pb-5 pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-2">
                  <LeadStatusBadge status={lead.classificationStatus} />
                  {decisionLabel ? (
                    <span className="rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {decisionLabel}
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <DialogTitle className="text-xl leading-tight text-balance sm:text-2xl">
                    {lead.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="size-3.5 shrink-0 text-muted-foreground/60" />
                    <span>{lead.companyName}</span>
                  </DialogDescription>
                </div>
              </div>

              <a
                href={lead.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
              >
                Abrir vaga
                <ExternalLink data-icon="inline-end" className="size-3.5" />
              </a>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
            <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60">
              <div className="border-b border-border/40 px-5 py-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                  Descrição completa
                </p>
                <h3 className="mt-1 text-base font-semibold text-foreground">
                  Conteúdo salvo localmente em markdown
                </h3>
              </div>
              <div className="px-5 py-5">
                <JobMarkdown
                  content={lead.description || "Descrição indisponível para este lead."}
                  className="rounded-xl border border-border/50 bg-muted/15 p-5"
                />
              </div>
            </section>

            <aside className="flex min-w-0 flex-col gap-4">
              <section className="rounded-2xl border border-zinc-700/80 bg-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="border-b border-border/40 px-5 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                    Resumo
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    Sinais principais do lead
                  </h3>
                </div>
                <div className="space-y-3 px-5 py-5">
                  <SummaryMetric
                    icon={Radar}
                    label="Score"
                    value={
                      lead.classificationScore !== null
                        ? String(lead.classificationScore)
                        : "Sem score"
                    }
                  />
                  <SummaryMetric
                    icon={Sparkles}
                    label="Senioridade"
                    value={formatSeniority(lead.seniority)}
                  />
                  <SummaryMetric
                    icon={MapPin}
                    label="Local"
                    value={lead.locationText || "Não informado"}
                  />
                  <SummaryMetric
                    icon={Wallet}
                    label="Faixa"
                    value={lead.salaryText || "Não informada"}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-800/80 bg-black/30">
                <div className="border-b border-border/40 px-5 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                    Justificativa
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    Motivo resumido da classificação
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {lead.classificationReason || "Sem justificativa resumida."}
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border/60 px-6 py-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {tab === "triage" ? (
              <>
                <form action={discardAction}>
                  <FormSubmitButton
                    pendingLabel="Descartando..."
                    variant="outline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Descartar
                  </FormSubmitButton>
                </form>

                <form action={approveAction}>
                  <FormSubmitButton
                    pendingLabel="Aprovando..."
                    onClick={(event) => event.stopPropagation()}
                  >
                    Aprovar lead
                  </FormSubmitButton>
                </form>
              </>
            ) : (
              <Button type="button" onClick={() => onCreateApplication(lead)}>
                Criar candidatura
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/30 px-3 py-3">
      <div className="rounded-lg border border-border/60 bg-background/60 p-2">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </p>
        <p className="mt-1 text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function formatSeniority(value: string | null) {
  switch (value) {
    case "intern":
      return "Estágio";
    case "junior":
      return "Júnior";
    case "mid":
      return "Pleno";
    case "senior":
      return "Sênior";
    case "staff":
      return "Staff";
    case "lead":
      return "Lead";
    default:
      return value || "Não informada";
  }
}
