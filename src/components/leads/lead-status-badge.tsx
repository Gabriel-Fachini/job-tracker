import { Status, type StatusTone } from "@/components/ui/status";
import { getJobLeadStatusLabel, isJobLeadStatus, type JobLeadStatus } from "@/lib/job-leads";

const leadStatusTone: Record<JobLeadStatus, StatusTone> = {
  interesting: "positive",
  review: "caution",
  discarded: "muted",
};

export function LeadStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = getJobLeadStatusLabel(status);

  if (!label || !isJobLeadStatus(status)) {
    return null;
  }

  return (
    <Status tone={leadStatusTone[status]} className={className}>
      {label}
    </Status>
  );
}
