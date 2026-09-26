"use client";

import { Radar, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import ShinyText from "@/components/ui/shiny-text";
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
  const progress = linksTotal > 0 ? Math.min(1, linksProcessed / linksTotal) : 0;

  const title = isRunning
    ? "Radar em andamento"
    : result?.success === false
      ? "Radar falhou"
      : result?.success === true
        ? "Radar concluído"
        : "Última varredura";

  return (
    <section
      aria-live="polite"
      className="animate-in rounded-2xl border border-border/60 bg-card/80 fade-in-0 slide-in-from-top-1 duration-200"
    >
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border",
            isRunning
              ? "border-brand/30 bg-brand/10 text-brand"
              : "border-border bg-foreground/5 text-muted-foreground",
          )}
        >
          <Radar className={cn("size-4", isRunning && "motion-safe:animate-pulse")} />
        </span>

        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "text-base font-semibold text-foreground",
              result?.success === false && !isRunning && "text-destructive",
            )}
          >
            {title}
          </h2>
          {currentCompany ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {currentCompany}
              <span className="tabular-nums">
                {" "}
                · {companyIndex}/{totalCompanies}
              </span>
            </p>
          ) : null}
        </div>

        {isRunning ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="shrink-0 rounded-lg"
          >
            <X data-icon="inline-start" />
            Cancelar
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            aria-label="Fechar resumo do radar"
            className="-mt-1 -mr-1 shrink-0 rounded-full text-muted-foreground"
          >
            <X />
          </Button>
        )}
      </div>

      {isRunning ? (
        <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
          {currentEvent ? (
            <div
              key={currentEvent.id}
              className="flex min-w-0 animate-in items-start gap-2.5 fade-in-0 slide-in-from-bottom-1 duration-300"
            >
              <span
                className={cn("mt-2 size-1.5 shrink-0 rounded-full", eventDotClass[currentEvent.type])}
              />
              <div className="min-w-0">
                <ShinyText
                  text={currentEvent.message}
                  color="#8a8a8a"
                  shineColor="#ffffff"
                  speed={2}
                  className="text-sm font-medium"
                />
                {currentEvent.detail ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {currentEvent.detail}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {linksTotal > 0 ? (
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="Vagas processadas"
                aria-valuemin={0}
                aria-valuemax={linksTotal}
                aria-valuenow={linksProcessed}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8"
              >
                <div
                  className="h-full origin-left rounded-full bg-emerald-400 transition-transform duration-300 ease-(--ease-out-quart)"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {linksProcessed}/{linksTotal}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-4 divide-x divide-border/60 border-t border-border/60">
        <StatBox label="Salvos" value={stats.leadsSaved} valueClassName="text-emerald-300" />
        <StatBox label="Revisar" value={stats.reviewsSaved} valueClassName="text-amber-200" />
        <StatBox label="Descartados" value={stats.discarded} />
        <StatBox
          label="Falhas"
          value={stats.failed}
          valueClassName={stats.failed > 0 ? "text-rose-300" : undefined}
        />
      </dl>
    </section>
  );
}

const eventDotClass: Record<MonitoringProgressEvent["type"], string> = {
  "company-start": "bg-sky-400",
  "link-done": "bg-emerald-400",
  "company-done": "bg-amber-300",
  error: "bg-rose-400",
};

function StatBox({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col-reverse items-center gap-1 px-1 py-3">
      <dt className="max-w-full truncate text-[11px] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-lg leading-none font-semibold text-foreground tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
