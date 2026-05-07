"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MonitoringActionResult } from "@/server/actions/job-monitoring";
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

  useEffect(() => {
    onProgressChange?.(progress);
  }, [progress]);

  function addEvent(
    type: MonitoringProgressEvent["type"],
    message: string,
    detail?: string
  ) {
    setProgress((prev) => {
      const newEvent: MonitoringProgressEvent = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type,
        message,
        detail,
      };
      return {
        ...prev,
        events: [newEvent, ...prev.events].slice(0, 50), // Keep last 50 events
      };
    });
  }

  function handleStreamStart() {
    setProgress({
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
    });
  }

  function handleStreamEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    switch (type) {
      case "start":
        setProgress((prev) => ({
          ...prev,
          totalCompanies: (event.total as number) || 0,
        }));
        break;

      case "company-start":
        const company = event.company as string;
        setProgress((prev) => ({
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
        setProgress((prev) => {
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
          setProgress((prev) => ({
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
        }
        break;

      case "error":
        const errorMsg = event.message as string;
        setProgress((prev) => ({
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
        break;
    }
  }

  function handleStreamEnd() {
    setProgress((prev) => ({
      ...prev,
      isRunning: false,
    }));
  }

  function handleStreamError() {
    setProgress((prev) => ({
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
    if (progress.eventSource) {
      progress.eventSource.close();
      setProgress((prev) => ({
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

      setProgress((prev) => ({
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
        } catch (error) {
          console.error("Failed to parse SSE message:", error);
        }
      };

      eventSource.onerror = () => {
        handleStreamError();
        eventSource.close();
        setProgress((prev) => ({
          ...prev,
          eventSource: null,
        }));
      };

      // Wait for all-done event
      await new Promise<void>((resolve) => {
        const originalOnmessage = eventSource.onmessage;
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (originalOnmessage) {
              originalOnmessage.call(eventSource, event);
            }
            handleStreamEvent(data);
            if (data.type === "all-done" || data.type === "error") {
              handleStreamEnd();
              eventSource.close();
              setProgress((prev) => ({
                ...prev,
                eventSource: null,
              }));
              resolve();
            }
          } catch (error) {
            console.error("Failed to parse SSE message:", error);
          }
        };
      });
    });
  }

  function handleActionClick() {
    if (!action) return;

    setProgress((prev) => ({
      ...prev,
      result: null,
    }));
    startTransition(async () => {
      const next = await action();
      setProgress((prev) => ({
        ...prev,
        result: next,
      }));
    });
  }

  const isRunning = useStream ? isPending : isPending;
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
          <RefreshCw
            data-icon="inline-start"
            className={cn(isRunning && "animate-spin")}
          />
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
