import { Badge } from "@/components/ui/badge";
import { getJobLeadStatusLabel, isJobLeadStatus } from "@/lib/job-leads";
import { cn } from "@/lib/utils";

export function LeadStatusBadge({ status }: { status: string }) {
  const label = getJobLeadStatusLabel(status);

  if (!label || !isJobLeadStatus(status)) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-border/60 bg-background/40 uppercase tracking-[0.14em]",
        status === "interesting" &&
          "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
        status === "review" &&
          "border-amber-400/30 bg-amber-400/10 text-amber-100",
        status === "discarded" &&
          "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
      )}
    >
      {label}
    </Badge>
  );
}
