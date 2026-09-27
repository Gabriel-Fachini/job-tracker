"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusDot, type StatusTone } from "@/components/ui/status";
import { cn } from "@/lib/utils";

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

/** Lines of the live log shown while the radar runs; newest first. */
const LOG_LINES = 3;

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

  const progress = linksTotal > 0 ? Math.min(1, linksProcessed / linksTotal) : 0;
  const failed = result?.success === false && !isRunning;

  const title = isRunning
    ? "Radar em execução"
    : failed
      ? "Radar falhou"
      : result?.success === true
        ? "Radar concluído"
        : "Última varredura";

  const titleTone: StatusTone = isRunning ? "active" : failed ? "negative" : "muted";

  return (
    <section
      aria-live="polite"
      className="animate-in overflow-hidden rounded-xl border border-border fade-in-0 duration-200"
    >
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <StatusDot tone={titleTone} pulse={isRunning} />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2
            className={cn(
              "text-sm font-medium text-foreground",
              failed && "text-negative",
            )}
          >
            {title}
          </h2>
          {currentCompany ? (
            <p className="min-w-0 truncate text-[13px] text-muted-foreground">
              {currentCompany}
              <span className="ml-2 font-data text-xs text-subtle-foreground">
                {companyIndex}/{totalCompanies}
              </span>
            </p>
          ) : null}
        </div>

        {isRunning ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="shrink-0">
            Cancelar
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            aria-label="Fechar resumo do radar"
            className="-mr-1.5 shrink-0"
          >
            <X />
          </Button>
        )}
      </div>

      {isRunning && linksTotal > 0 ? (
        <div className="flex items-center gap-3 px-4 pb-3 sm:px-5">
          <div
            role="progressbar"
            aria-label="Vagas processadas"
            aria-valuemin={0}
            aria-valuemax={linksTotal}
            aria-valuenow={linksProcessed}
            className="h-px flex-1 overflow-hidden bg-border"
          >
            <div
              className="h-full origin-left bg-foreground transition-transform duration-300 ease-(--ease-out-quart)"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          <span className="shrink-0 font-data text-xs text-subtle-foreground">
            {linksProcessed}/{linksTotal}
          </span>
        </div>
      ) : null}

      {isRunning && events.length > 0 ? (
        <ol className="flex flex-col gap-1 border-t border-border bg-canvas px-4 py-3 font-data text-xs sm:px-5">
          {events.slice(0, LOG_LINES).map((event, index) => (
            <li
              key={event.id}
              className={cn(
                "flex min-w-0 items-baseline gap-3",
                index === 0 ? "text-muted-foreground" : "text-subtle-foreground",
                index === 0 && "animate-in fade-in-0 duration-300",
              )}
            >
              <time dateTime={event.timestamp.toISOString()} className="shrink-0 text-subtle-foreground">
                {formatClock(event.timestamp)}
              </time>
              <span className={cn("shrink-0", eventTypeClass[event.type])}>
                {eventTypeLabel[event.type]}
              </span>
              <span className="min-w-0 truncate">{event.message}</span>
              {event.detail ? (
                <span className="hidden shrink-0 text-subtle-foreground sm:inline">
                  {event.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2.5 text-xs sm:px-5">
        <Stat label="salvos" value={stats.leadsSaved} valueClassName={stats.leadsSaved > 0 ? "text-positive" : undefined} />
        <Stat label="revisar" value={stats.reviewsSaved} valueClassName={stats.reviewsSaved > 0 ? "text-caution" : undefined} />
        <Stat label="descartados" value={stats.discarded} />
        <Stat
          label="falhas"
          value={stats.failed}
          valueClassName={stats.failed > 0 ? "text-negative" : undefined}
        />
      </dl>
    </section>
  );
}

const eventTypeLabel: Record<MonitoringProgressEvent["type"], string> = {
  "company-start": "empresa",
  "link-done": "vaga",
  "company-done": "fim",
  error: "erro",
};

const eventTypeClass: Record<MonitoringProgressEvent["type"], string> = {
  "company-start": "text-muted-foreground",
  "link-done": "text-muted-foreground",
  "company-done": "text-muted-foreground",
  error: "text-negative",
};

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="order-2 text-subtle-foreground">{label}</dt>
      <dd className={cn("order-1 font-data text-[13px] font-medium text-foreground", valueClassName)}>
        {value}
      </dd>
    </div>
  );
}
