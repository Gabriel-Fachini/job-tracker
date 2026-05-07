"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMonitoringActions, useMonitoringProgress } from "@/components/leads/monitoring-progress-context";
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
}: MonitoringRunButtonProps) {
  const [isPending, startTransition] = useTransition();
  const contextProgress = useMonitoringProgress();
  const { startMonitoring, cancelMonitoring } = useMonitoringActions();

  const isRunning = contextProgress?.isRunning ?? isPending;

  const displayLabel = (() => {
    if (!isRunning) return label;

    if (contextProgress?.currentCompany) {
      if (contextProgress.linksTotal > 0) {
        return `${pendingLabel} - ${contextProgress.currentCompany} (${contextProgress.linksProcessed}/${contextProgress.linksTotal})`;
      }
      return `${pendingLabel} - ${contextProgress.currentCompany}`;
    }

    return pendingLabel;
  })();

  function handleClick() {
    if (!action) {
      if (useStream) {
        startMonitoring();
      }
      return;
    }

    startTransition(async () => {
      await action();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handleClick}
          disabled={isRunning}
          className={className}
        >
          <RefreshCw className={cn(isRunning && "animate-spin")} />
          {displayLabel}
        </Button>

        {isRunning && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancelMonitoring}
            className="rounded-lg"
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
