"use client";

import { X, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ui/shiny-text";

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
  result?: { success: boolean } | null;
  onCancel: () => void;
  onDismiss: () => void;
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
  result,
  onCancel,
  onDismiss,
}: MonitoringProgressDisplayProps) {
  if (!isRunning && events.length === 0) {
    return null;
  }

  const currentEvent = events[0];

  const getHeaderTitle = () => {
    if (isRunning) return "Monitoramento em andamento";
    if (result?.success === true) return "Radar concluído";
    if (result?.success === false) return "Radar falhou";
    return "Último monitoramento";
  };

  const getHeaderTitleColor = () => {
    if (isRunning) return "";
    if (result?.success === true) return "text-emerald-600";
    if (result?.success === false) return "text-destructive";
    return "";
  };

  return (
    <>
      <style>{animationStyle}</style>
      <Card className="border-border/60 bg-card/85">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <Radar className="size-5 text-muted-foreground shrink-0" />
              <div className="space-y-1 flex-1">
                <h3 className={cn("text-lg font-semibold", getHeaderTitleColor())}>
                  {getHeaderTitle()}
                </h3>
                {currentCompany && (
                  <p className="text-sm text-muted-foreground">
                    {currentCompany} ({companyIndex}/{totalCompanies})
                    {linksTotal > 0 && ` • ${linksProcessed}/${linksTotal} vagas processadas`}
                  </p>
                )}
              </div>
            </div>

            {isRunning && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="w-full rounded-lg sm:w-auto"
              >
                <X className="size-4" />
                Cancelar
              </Button>
            )}

            {!isRunning && events.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDismiss}
                className="w-full rounded-lg sm:w-auto"
              >
                Fechar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Current Action - only while running */}
          {isRunning && currentEvent && (
            <Card className="border-border/60 bg-card/50">
              <CardContent className="pt-4">
                <div className="animate-fade-in-up">
                  <TimelineEvent event={currentEvent} hideTime={true} isCurrentAction={true} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vagas progress bar */}
          {isRunning && linksTotal > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Vagas: {linksProcessed}/{linksTotal}
              </p>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all"
                  style={{
                    width: `${(linksProcessed / linksTotal) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        </CardContent>
      </Card>
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
          {isCurrentAction ? (
            <ShinyText
              text={event.message}
              color="#6b7280"
              shineColor="#ffffff"
              speed={2}
              className="text-base font-semibold"
            />
          ) : (
            <p className="font-medium text-foreground">
              {event.message}
            </p>
          )}
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
