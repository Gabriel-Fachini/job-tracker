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
  /** Replaces `label` on phones, where the button shares a row with the title. */
  shortLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  useStream?: boolean;
  /** Hide when a progress panel on the same screen already offers Cancel. */
  showCancel?: boolean;
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
  shortLabel,
  className,
  variant = "default",
  useStream = false,
  showCancel = true,
}: MonitoringRunButtonProps) {
  const [isPending, startTransition] = useTransition();
  const contextProgress = useMonitoringProgress();
  const { startMonitoring, cancelMonitoring } = useMonitoringActions();

  // A finished stream run leaves progress in context; the action's own pending
  // state must still count.
  const isStreamRunning = contextProgress?.isRunning ?? false;
  const isRunning = isStreamRunning || isPending;

  const progressDetail =
    isStreamRunning && contextProgress?.currentCompany
      ? contextProgress.linksTotal > 0
        ? `${contextProgress.currentCompany} (${contextProgress.linksProcessed}/${contextProgress.linksTotal})`
        : contextProgress.currentCompany
      : null;

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
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={variant}
        onClick={handleClick}
        disabled={isRunning}
        className={cn("min-w-0", className)}
      >
        <RefreshCw
          data-icon="inline-start"
          className={cn(isRunning && "motion-safe:animate-spin")}
        />
        {isRunning ? (
          <span className="truncate">
            {pendingLabel}
            {progressDetail ? (
              <span className="hidden font-data text-xs opacity-70 sm:inline"> {progressDetail}</span>
            ) : null}
          </span>
        ) : shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </Button>

      {showCancel && isStreamRunning ? (
        <Button type="button" variant="outline" onClick={cancelMonitoring}>
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}
