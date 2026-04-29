"use client";

import {
  Building2,
  CalendarDays,
  ExternalLink,
  Layers3,
  RadioTower,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { JobMarkdown } from "@/components/applications/job-markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { type ApplicationStatus } from "@/lib/applications";
import {
  getSeniorityLabel,
  getSourceNameLabel,
  getWorkModelLabel,
} from "@/lib/jobs";

export type ApplicationDetailData = {
  id: number;
  status: ApplicationStatus;
  jobTitle: string;
  company: string | null;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  workModel: string | null;
  seniority: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  notes: string | null;
};

type MetaItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type ApplicationDetailModalProps = {
  application: ApplicationDetailData | null;
  onClose: () => void;
};

export function ApplicationDetailModal({
  application,
  onClose,
}: ApplicationDetailModalProps) {
  if (!application) return null;

  const metaItems: MetaItem[] = [
    {
      label: "Empresa",
      value: application.company ?? "Não informada",
      icon: Building2,
    },
    {
      label: "Origem",
      value: getSourceNameLabel(application.sourceName) ?? "Não informada",
      icon: RadioTower,
    },
    {
      label: "Modelo",
      value: getWorkModelLabel(application.workModel) ?? "Não informado",
      icon: Layers3,
    },
    {
      label: "Senioridade",
      value: getSeniorityLabel(application.seniority) ?? "Não informada",
      icon: Sparkles,
    },
    {
      label: "Registrada em",
      value: application.createdAt.toLocaleDateString("pt-BR"),
      icon: CalendarDays,
    },
  ];

  return (
    <Dialog open={!!application} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-3xl">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border/50 px-6 pb-5 pt-6">
          <div className="flex flex-col gap-3">
            {/* Status + external link row */}
            <div className="flex items-center justify-between gap-3">
              <ApplicationStatusBadge status={application.status} />
              {application.sourceUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={application.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                  className="h-8 gap-1.5 rounded-lg border-border/60 text-xs"
                >
                  Ver vaga original
                  <ExternalLink data-icon="inline-end" className="size-3" />
                </Button>
              ) : null}
            </div>

            {/* Title + company */}
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-xl leading-tight text-balance">
                {application.jobTitle}
              </DialogTitle>
              {application.company ? (
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    {application.company}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-6 px-6 py-6">
            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {metaItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="size-3 text-muted-foreground/60" />
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                        {item.label}
                      </p>
                    </div>
                    <p className="text-sm font-medium leading-5 text-foreground/90">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            {application.notes ? (
              <>
                <Separator className="bg-border/40" />
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                    Notas
                  </p>
                  <p className="text-sm leading-6 text-foreground/80">
                    {application.notes}
                  </p>
                </div>
              </>
            ) : null}

            <Separator className="bg-border/40" />

            {/* Description */}
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                Descrição da vaga
              </p>
              <JobMarkdown
                content={application.description}
                className="rounded-xl border border-border/50 bg-muted/15 p-5"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/50 px-6 py-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
