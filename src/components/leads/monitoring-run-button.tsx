"use client";

import { useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MonitoringActionResult } from "@/server/actions/job-monitoring";
import type { LeadListItem } from "@/components/leads/types";
import { cn } from "@/lib/utils";

export type MonitoringProgressEvent = {
  id: string;
  timestamp: Date;
  type: "company-start" | "link-done" | "company-done" | "error";
  message: string;
  detail?: string;
};

type MonitoringRunButtonProps = {
  action?: () => Promise<MonitoringActionResult>;
  label: string;
  pendingLabel: string;
  className?: string;
  useStream?: boolean;
  onProgressChange?: (progress: MonitoringProgress) => void;
  onLeadAppended?: (lead: LeadListItem) => void;
  onComplete?: () => void;
};

export type MonitoringProgress = {
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
  result: MonitoringActionResult | null;
  eventSource: EventSource | null;
};

export function MonitoringRunButton({
  action,
  label,
  pendingLabel,
  className,
  useStream = false,
  onProgressChange,
  onLeadAppended,
  onComplete,
}: MonitoringRunButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<MonitoringProgress>({
    isRunning: false,
    currentCompany: null,
    companyIndex: 0,
    totalCompanies: 0,
    linksProcessed: 0,
    linksTotal: 0,
    events: [],
    stats: {
      leadsSaved: 0,
      reviewsSaved: 0,
      discarded: 0,
      failed: 0,
    },
    result: null,
    eventSource: null,
  });

  const onProgressChangeRef = useRef(onProgressChange);
  onProgressChangeRef.current = onProgressChange;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const progressRef = useRef(progress);

  function updateProgress(updater: (prev: MonitoringProgress) => MonitoringProgress) {
    const next = updater(progressRef.current);
    progressRef.current = next;
    setProgress(next);
    onProgressChangeRef.current?.(next);
  }

  function addEvent(
    type: MonitoringProgressEvent["type"],
    message: string,
    detail?: string
  ) {
    updateProgress((prev) => {
      const newEvent: MonitoringProgressEvent = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type,
        message,
        detail,
      };
      return {
        ...prev,
        events: [newEvent, ...prev.events].slice(0, 50),
      };
    });
  }

  function handleStreamStart() {
    updateProgress(() => ({
      isRunning: true,
      currentCompany: null,
      companyIndex: 0,
      totalCompanies: 0,
      linksProcessed: 0,
      linksTotal: 0,
      events: [],
      stats: {
        leadsSaved: 0,
        reviewsSaved: 0,
        discarded: 0,
        failed: 0,
      },
      result: null,
      eventSource: null,
    }));
  }

  function handleStreamEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    switch (type) {
      case "start":
        updateProgress((prev) => ({
          ...prev,
          totalCompanies: (event.total as number) || 0,
        }));
        break;

      case "link-processing":
        updateProgress((prev) => ({
          ...prev,
          linksProcessed: (event.processed as number) || 0,
          linksTotal: (event.total as number) || 0,
        }));
        break;

      case "company-start":
        const company = event.company as string;
        updateProgress((prev) => ({
          ...prev,
          currentCompany: company,
          companyIndex: (event.index as number) || 0,
          totalCompanies: (event.total as number) || prev.totalCompanies,
          linksProcessed: 0,
          linksTotal: 0,
        }));
        addEvent("company-start", `Iniciando varredura em ${company}`);
        break;

      case "link-done":
        const decision = event.decision as string;
        const title = event.title as string;
        const lead = event.lead as LeadListItem | undefined;
        updateProgress((prev) => {
          const newStats = { ...prev.stats };
          if (decision === "interesting") newStats.leadsSaved += 1;
          if (decision === "review") newStats.reviewsSaved += 1;
          if (decision === "discarded") newStats.discarded += 1;

          return {
            ...prev,
            linksProcessed: (event.processed as number) || 0,
            linksTotal: (event.total as number) || 0,
            stats: newStats,
          };
        });
        addEvent(
          "link-done",
          `Vaga processada: ${title}`,
          `Classificação: ${decision}`
        );
        if (lead) {
          onLeadAppended?.(lead);
        }
        break;

      case "company-done":
        const companyName = event.company as string;
        addEvent("company-done", `Varredura em ${companyName} concluída`);
        break;

      case "all-done":
        if (event.summary) {
          const summary = event.summary as {
            linksFound: number;
            jobsParsed: number;
            leadsSaved: number;
            reviewsSaved: number;
            discarded: number;
            failed: number;
          };
          updateProgress((prev) => ({
            ...prev,
            isRunning: false,
            result: {
              success: true,
              label: "radar completo",
              ...summary,
            },
          }));
          addEvent(
            "company-done",
            `Radar concluído: ${summary.leadsSaved} salvos, ${summary.reviewsSaved} para revisar`
          );
          onCompleteRef.current?.();
        }
        break;

      case "error":
        const errorMsg = event.message as string;
        updateProgress((prev) => ({
          ...prev,
          isRunning: false,
          result: {
            success: false,
            label: prev.currentCompany || "radar",
            linksFound: 0,
            jobsParsed: 0,
            leadsSaved: 0,
            reviewsSaved: 0,
            discarded: 0,
            failed: 0,
            error: errorMsg,
          },
        }));
        addEvent("error", errorMsg);
        onCompleteRef.current?.();
        break;
    }
  }

  function handleStreamError() {
    updateProgress((prev) => ({
      ...prev,
      isRunning: false,
      result: {
        success: false,
        label: prev.currentCompany || "radar",
        linksFound: 0,
        jobsParsed: 0,
        leadsSaved: 0,
        reviewsSaved: 0,
        discarded: 0,
        failed: 0,
        error: "Conexão perdida durante a varredura.",
      },
    }));
    addEvent("error", "Conexão perdida durante a varredura");
  }

  function handleCancel() {
    if (progressRef.current.eventSource) {
      progressRef.current.eventSource.close();
      updateProgress((prev) => ({
        ...prev,
        isRunning: false,
        eventSource: null,
      }));
      addEvent("error", "Varredura cancelada pelo usuário");
    }
  }

  function handleStreamClick() {
    handleStreamStart();
    startTransition(async () => {
      const eventSource = new EventSource("/api/monitoring/stream?type=all");

      updateProgress((prev) => ({
        ...prev,
        eventSource,
      }));

      eventSource.onopen = () => {
        // Connected
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleStreamEvent(data);
          if (data.type === "all-done" || data.type === "error") {
            eventSource.close();
            updateProgress((prev) => ({ ...prev, eventSource: null, isRunning: false }));
          }
        } catch (error) {
          console.error("Failed to parse SSE message:", error);
        }
      };

      eventSource.onerror = () => {
        handleStreamError();
        eventSource.close();
        updateProgress((prev) => ({
          ...prev,
          eventSource: null,
        }));
      };

      // Wait for all-done event or external cancel
      await new Promise<void>((resolve) => {
        const checkComplete = setInterval(() => {
          const cur = progressRef.current;
          const externallyTerminated =
            cur.eventSource !== null && cur.eventSource.readyState === 2;

          if (!cur.isRunning || externallyTerminated) {
            if (externallyTerminated) {
              updateProgress((prev) => ({ ...prev, isRunning: false, eventSource: null }));
            }
            clearInterval(checkComplete);
            resolve();
          }
        }, 100);
      });
    });
  }

  function handleActionClick() {
    if (!action) return;

    updateProgress((prev) => ({
      ...prev,
      result: null,
    }));
    startTransition(async () => {
      const next = await action();
      updateProgress((prev) => ({
        ...prev,
        result: next,
      }));
    });
  }

  const isRunning = useStream ? progress.isRunning : isPending;
  const displayLabel = (() => {
    if (!isRunning) return label;

    if (useStream) {
      if (progress.currentCompany) {
        if (progress.linksTotal > 0) {
          return `${pendingLabel} - ${progress.currentCompany} (${progress.linksProcessed}/${progress.linksTotal})`;
        }
        return `${pendingLabel} - ${progress.currentCompany}`;
      }
      return pendingLabel;
    }

    return pendingLabel;
  })();

  const resultMessage = (() => {
    if (!progress.result) return null;

    if (progress.result.success) {
      return `${progress.result.label}: ${progress.result.leadsSaved} leads salvos, ${progress.result.reviewsSaved} para revisar, ${progress.result.discarded} descartados${progress.result.failed > 0 ? `, ${progress.result.failed} com falha` : ""}.`;
    }

    return progress.result.error || "Não foi possível concluir a varredura.";
  })();

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={useStream ? handleStreamClick : handleActionClick}
          disabled={isRunning}
          className={className}
        >
          <RefreshCw className={cn(isRunning && "animate-spin")} />
          {displayLabel}
        </Button>

        {isRunning && useStream && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="rounded-lg"
          >
            Cancelar
          </Button>
        )}
      </div>

      {resultMessage ? (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            !progress.result?.success && "text-destructive",
          )}
        >
          {resultMessage}
        </p>
      ) : null}
    </div>
  );
}
