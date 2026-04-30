"use client";

import { useState } from "react";
import { Building2, MapPin, Waypoints, Zap } from "lucide-react";

import {
  ApplicationCreateModal,
} from "@/components/applications/application-create-modal";
import {
  ApplicationDetailModal,
  type ApplicationDetailData,
} from "@/components/applications/application-detail-modal";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isApplicationStatus } from "@/lib/applications";
import {
  formatDate,
  getSeniorityLabel,
  getSourceNameLabel,
  getWorkModelLabel,
} from "@/lib/jobs";

type ApplicationListItem = {
  id: number;
  status: string;
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

type ApplicationsClientProps = {
  companies: Array<{
    id: number;
    name: string;
  }>;
  items: ApplicationListItem[];
};

const workModelIcons: Record<string, string> = {
  remote: "🌐",
  hybrid: "🏢",
  onsite: "📍",
};

function ApplicationCard({
  item,
  onClick,
}: {
  item: ApplicationListItem;
  onClick: () => void;
}) {
  const workModelLabel = getWorkModelLabel(item.workModel);
  const seniorityLabel = getSeniorityLabel(item.seniority);
  const sourceNameLabel = getSourceNameLabel(item.sourceName);
  const workModelEmoji = item.workModel ? workModelIcons[item.workModel] : null;

  return (
    <button
      key={item.id}
      id={`application-card-${item.id}`}
      type="button"
      onClick={onClick}
      className="group block w-full text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="relative overflow-hidden border border-border/60 bg-card transition-all duration-200 group-hover:border-border/90 group-hover:shadow-[0_8px_40px_rgba(0,0,0,0.28)]">
        {/* Subtle top accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <CardHeader className="pb-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-lg leading-snug text-foreground transition-colors group-hover:text-foreground/90">
                {item.jobTitle}
              </CardTitle>
              {item.company ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Building2 className="size-3 shrink-0 text-muted-foreground/70" />
                  <span className="truncate text-sm text-muted-foreground">
                    {item.company}
                  </span>
                </div>
              ) : (
                <div className="mt-1.5">
                  <span className="text-sm text-muted-foreground/50 italic">
                    Empresa não informada
                  </span>
                </div>
              )}
            </div>
            <div className="shrink-0">
              {isApplicationStatus(item.status) ? (
                <ApplicationStatusBadge status={item.status} />
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pb-4 pt-0">
          {/* Meta tags */}
          <div className="flex flex-wrap gap-1.5">
            {workModelLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {workModelEmoji && <span>{workModelEmoji}</span>}
                {workModelLabel}
              </span>
            ) : null}
            {seniorityLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/8 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-violet-300/80">
                <Zap className="size-2.5" />
                {seniorityLabel}
              </span>
            ) : null}
            {sourceNameLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/8 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sky-300/80">
                {sourceNameLabel}
              </span>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">
              {formatDate(item.createdAt)}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-all group-hover:text-foreground/70 group-hover:translate-x-0.5">
              Ver detalhes
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export function ApplicationsClient({ companies, items }: ApplicationsClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<ApplicationDetailData | null>(null);

  function handleCardClick(item: ApplicationListItem) {
    if (!isApplicationStatus(item.status)) return;
    setDetailApp({
      id: item.id,
      status: item.status,
      jobTitle: item.jobTitle,
      company: item.company,
      description: item.description,
      sourceUrl: item.sourceUrl,
      sourceName: item.sourceName,
      workModel: item.workModel,
      seniority: item.seniority,
      appliedAt: item.appliedAt,
      createdAt: item.createdAt,
      notes: item.notes,
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
            Todas as candidaturas
          </p>
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Nenhuma registrada ainda"
              : items.length === 1
              ? "1 candidatura registrada"
              : `${items.length} candidaturas registradas`}
          </p>
        </div>

        <Button
          id="btn-nova-candidatura"
          size="lg"
          onClick={() => setCreateOpen(true)}
          className="h-11 min-w-44 justify-center rounded-xl bg-amber-300 px-6 text-zinc-950 shadow-[0_8px_28px_rgba(252,211,77,0.28)] transition-all hover:bg-amber-200 hover:shadow-[0_12px_36px_rgba(252,211,77,0.36)]"
        >
          <Waypoints data-icon="inline-start" />
          Nova candidatura
        </Button>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border/50 bg-card/40 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
            <MapPin className="size-7 text-muted-foreground/50" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-medium text-foreground/80">
              Nenhuma candidatura registrada
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Registre sua primeira candidatura e acompanhe o processo seletivo de perto.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-1 h-10 rounded-xl bg-amber-300 px-5 text-zinc-950 hover:bg-amber-200"
          >
            <Waypoints data-icon="inline-start" />
            Registrar primeira candidatura
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <ApplicationCard
              key={item.id}
              item={item}
              onClick={() => handleCardClick(item)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ApplicationCreateModal
        companies={companies}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <ApplicationDetailModal
        application={detailApp}
        onClose={() => setDetailApp(null)}
      />
    </>
  );
}
