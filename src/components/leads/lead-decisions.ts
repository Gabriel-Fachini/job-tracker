"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { LeadListItem } from "@/components/leads/types";
import { approveLead, discardLead } from "@/server/actions/job-monitoring";

/**
 * Optimistic approve/discard shared by the lead row and the detail sheet.
 * `onOptimisticUpdate` runs right after the cache changes (e.g. to close a sheet).
 */
export function useLeadDecisions(leadId: number, onOptimisticUpdate?: () => void) {
  const queryClient = useQueryClient();
  const [isApproving, startApproveTransition] = useTransition();
  const [isDiscarding, startDiscardTransition] = useTransition();

  function approve() {
    startApproveTransition(async () => {
      queryClient.setQueryData(["leads"], (old: LeadListItem[] | undefined) =>
        old?.map((item) =>
          item.id === leadId ? { ...item, userDecision: "approved" as const } : item,
        ),
      );
      onOptimisticUpdate?.();
      await approveLead(leadId);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead aprovado");
    });
  }

  function discard(reason?: string | null) {
    startDiscardTransition(async () => {
      queryClient.setQueryData(["leads"], (old: LeadListItem[] | undefined) =>
        old?.filter((item) => item.id !== leadId),
      );
      onOptimisticUpdate?.();
      await discardLead(leadId, reason ?? null);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead descartado");
    });
  }

  return { approve, discard, isApproving, isDiscarding };
}

export function scoreTone(score: number) {
  if (score >= 80) return "positive" as const;
  if (score >= 50) return "caution" as const;
  return "muted" as const;
}

const scoreTextClass = {
  positive: "text-positive",
  caution: "text-caution",
  muted: "text-muted-foreground",
} as const;

const scoreFillClass = {
  positive: "bg-positive",
  caution: "bg-caution",
  muted: "bg-muted-foreground",
} as const;

/** Text and meter-fill classes for a classifier score (0-100). */
export function scoreClasses(score: number) {
  const tone = scoreTone(score);
  return { text: scoreTextClass[tone], fill: scoreFillClass[tone] };
}
