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

const animationStyle = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.3s ease-out;
  }
  @keyframes shimmer {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }
  .animate-shimmer {
    animation: shimmer 1.5s ease-in-out infinite;
  }
`;

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

  const currentEvent = events[0];

  return (
    <>
      <style>{animationStyle}</style>
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

        {/* Current Action - Animated */}
        {currentEvent && (
          <Card className="border-border/60 bg-card/50">
            <CardContent className="pt-4">
              <div className="animate-fade-in-up">
                <TimelineEvent event={currentEvent} hideTime={true} isCurrentAction={true} />
              </div>
            </CardContent>
          </Card>
        )}

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

      </div>
    </>
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

function TimelineEvent({
  event,
  hideTime = false,
  isCurrentAction = false,
}: {
  event: MonitoringProgressEvent;
  hideTime?: boolean;
  isCurrentAction?: boolean;
}) {
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
    <div className={cn("flex gap-3", isCurrentAction ? "text-lg" : "text-xs")}>
      <div
        className={cn(
          "mt-1 size-2 rounded-full shrink-0",
          dotColor,
          isCurrentAction && "size-3"
        )}
      />
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "font-medium text-foreground",
              isCurrentAction && "animate-shimmer text-base font-semibold"
            )}
          >
            {event.message}
          </p>
          {!hideTime && <span className="text-muted-foreground">{timeStr}</span>}
        </div>
        {event.detail && (
          <p className={cn("text-muted-foreground", isCurrentAction && "text-sm")}>
            {event.detail}
          </p>
        )}
      </div>
    </div>
  );
}
