"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MonitoringActionResult } from "@/server/actions/job-monitoring";
import { cn } from "@/lib/utils";

type MonitoringRunButtonProps = {
  action?: () => Promise<MonitoringActionResult>;
  label: string;
  pendingLabel: string;
  className?: string;
  useStream?: boolean;
};

export function MonitoringRunButton({
  action,
  label,
  pendingLabel,
  className,
  useStream = false,
}: MonitoringRunButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MonitoringActionResult | null>(null);
  const [currentCompany, setCurrentCompany] = useState<string | null>(null);
  const [companyIndex, setCompanyIndex] = useState<number>(0);
  const [totalCompanies, setTotalCompanies] = useState<number>(0);
  const [linksProcessed, setLinksProcessed] = useState<number>(0);
  const [linksTotal, setLinksTotal] = useState<number>(0);

  function handleStreamStart() {
    setCurrentCompany(null);
    setCompanyIndex(0);
    setTotalCompanies(0);
    setLinksProcessed(0);
    setLinksTotal(0);
    setResult(null);
  }

  function handleStreamEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    switch (type) {
      case "start":
        setTotalCompanies(event.total as number);
        break;
      case "company-start":
        setCurrentCompany(event.company as string);
        setCompanyIndex((event.index as number) || 0);
        setTotalCompanies((event.total as number) || 0);
        setLinksProcessed(0);
        setLinksTotal(0);
        break;
      case "link-done":
        setLinksProcessed((event.processed as number) || 0);
        setLinksTotal((event.total as number) || 0);
        break;
      case "company-done":
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
          setResult({
            success: true,
            label: currentCompany || "radar completo",
            ...summary,
          });
        }
        break;
      case "error":
        setResult({
          success: false,
          label: currentCompany || "radar",
          linksFound: 0,
          jobsParsed: 0,
          leadsSaved: 0,
          reviewsSaved: 0,
          discarded: 0,
          failed: 0,
          error: event.message as string,
        });
        break;
    }
  }

  function handleStreamEnd() {
    // Stream closed, UI already shows final state
  }

  function handleStreamError() {
    setResult({
      success: false,
      label: currentCompany || "radar",
      linksFound: 0,
      jobsParsed: 0,
      leadsSaved: 0,
      reviewsSaved: 0,
      discarded: 0,
      failed: 0,
      error: "Conexão perdida durante a varredura.",
    });
  }

  function handleStreamClick() {
    handleStreamStart();
    startTransition(async () => {
      const eventSource = new EventSource("/api/monitoring/stream?type=all");

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

    setResult(null);
    startTransition(async () => {
      const next = await action();
      setResult(next);
    });
  }

  const isRunning = useStream ? isPending : isPending;
  const displayLabel = (() => {
    if (!isRunning) return label;

    if (useStream) {
      if (currentCompany) {
        if (linksTotal > 0) {
          return `${pendingLabel} - ${currentCompany} (${linksProcessed}/${linksTotal})`;
        }
        return `${pendingLabel} - ${currentCompany}`;
      }
      return pendingLabel;
    }

    return pendingLabel;
  })();

  const resultMessage = (() => {
    if (!result) return null;

    if (result.success) {
      return `${result.label}: ${result.leadsSaved} leads salvos, ${result.reviewsSaved} para revisar, ${result.discarded} descartados${result.failed > 0 ? `, ${result.failed} com falha` : ""}.`;
    }

    return result.error || "Não foi possível concluir a varredura.";
  })();

  return (
    <div className="flex flex-col items-start gap-2">
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

      {resultMessage ? (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            !result?.success && "text-destructive",
          )}
        >
          {resultMessage}
        </p>
      ) : null}
    </div>
  );
}
