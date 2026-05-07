"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MonitoringStreamEvent } from "@/lib/job-monitoring/types";

type MonitoringProgressEvent = {
  id: string;
  timestamp: Date;
  type: "company-start" | "link-done" | "company-done" | "error";
  message: string;
  detail?: string;
};

type MonitoringProgressDisplayProps = {
  isRunning: boolean;
  currentCompany: string | null;
  companyIndex: number;
  totalCompanies: number;
  linksProcessed: number;
  linksTotal: number;
  events: MonitoringProgressEvent[];
  stats: {
    leadsSaved: number;
    reviewsSaved: number;
    discarded: number;
    failed: number;
  };
  onCancel: () => void;
};

export function MonitoringProgressDisplay({
  isRunning,
  currentCompany,
  companyIndex,
  totalCompanies,
  linksProcessed,
  linksTotal,
  events,
  stats,
  onCancel,
}: MonitoringProgressDisplayProps) {
  if (!isRunning && events.length === 0) {
    return null;
  }

  const totalProcessed = stats.leadsSaved + stats.reviewsSaved + stats.discarded;
  const successRate = totalProcessed > 0 ? stats.leadsSaved + stats.reviewsSaved : 0;

  return (
    <div className="mb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">
            {isRunning ? "Monitoramento em andamento" : "Último monitoramento"}
          </h3>
          {currentCompany && (
            <p className="text-sm text-muted-foreground">
              {currentCompany} ({companyIndex}/{totalCompanies})
              {linksTotal > 0 && ` • ${linksProcessed}/${linksTotal} vagas processadas`}
            </p>
          )}
        </div>

        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="rounded-lg"
          >
            <X className="size-4" />
            Cancelar
          </Button>
        )}
      </div>

      {/* Progress Bars */}
      {isRunning && companyIndex > 0 && (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Empresas: {companyIndex}/{totalCompanies}
            </p>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                style={{
                  width: `${(companyIndex / totalCompanies) * 100}%`,
                }}
              />
            </div>
          </div>

          {linksTotal > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Vagas: {linksProcessed}/{linksTotal}
              </p>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                  style={{
                    width: `${(linksProcessed / linksTotal) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        <StatBox
          label="Salvos"
          value={stats.leadsSaved}
          className="bg-emerald-500/10 border-emerald-500/20"
        />
        <StatBox
          label="Revisar"
          value={stats.reviewsSaved}
          className="bg-amber-500/10 border-amber-500/20"
        />
        <StatBox
          label="Descartados"
          value={stats.discarded}
          className="bg-red-500/10 border-red-500/20"
        />
        <StatBox
          label="Falhas"
          value={stats.failed}
          className="bg-orange-500/10 border-orange-500/20"
        />
      </div>

      {/* Timeline */}
      {events.length > 0 && (
        <Card className="border-border/60 bg-card/50">
          <CardContent className="pt-4">
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {events.map((event) => (
                <TimelineEvent key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={cn("rounded-lg border p-2 text-center", className)}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TimelineEvent({ event }: { event: MonitoringProgressEvent }) {
  const timeStr = event.timestamp.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const iconColor = {
    "company-start": "text-blue-500",
    "link-done": "text-emerald-500",
    "company-done": "text-amber-500",
    error: "text-red-500",
  }[event.type];

  const dotColor = {
    "company-start": "bg-blue-500",
    "link-done": "bg-emerald-500",
    "company-done": "bg-amber-500",
    error: "bg-red-500",
  }[event.type];

  return (
    <div className="flex gap-3 text-xs">
      <div className={cn("mt-1 size-2 rounded-full shrink-0", dotColor)} />
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-foreground">{event.message}</p>
          <span className="text-muted-foreground">{timeStr}</span>
        </div>
        {event.detail && <p className="text-muted-foreground">{event.detail}</p>}
      </div>
    </div>
  );
}
