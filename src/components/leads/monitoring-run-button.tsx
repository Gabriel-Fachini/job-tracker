"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MonitoringActionResult } from "@/server/actions/job-monitoring";
import { cn } from "@/lib/utils";

type MonitoringRunButtonProps = {
  action: () => Promise<MonitoringActionResult>;
  label: string;
  pendingLabel: string;
  className?: string;
};

export function MonitoringRunButton({
  action,
  label,
  pendingLabel,
  className,
}: MonitoringRunButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MonitoringActionResult | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        onClick={() => {
          startTransition(async () => {
            const next = await action();
            setResult(next);
          });
        }}
        disabled={isPending}
        className={className}
      >
        <RefreshCw
          data-icon="inline-start"
          className={cn(isPending && "animate-spin")}
        />
        {isPending ? pendingLabel : label}
      </Button>

      {result ? (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            !result.success && "text-destructive",
          )}
        >
          {result.success
            ? `${result.label}: ${result.leadsSaved} leads salvos, ${result.reviewsSaved} para revisar, ${result.discarded} descartados, ${result.failed} com falha.`
            : result.error || "Nao foi possivel concluir a varredura."}
        </p>
      ) : null}
    </div>
  );
}
