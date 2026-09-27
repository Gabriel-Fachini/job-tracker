import { Tag, type TagColor } from "@/components/ui/tag";
import { getJobLeadStatusLabel, isJobLeadStatus, type JobLeadStatus } from "@/lib/job-leads";

const leadStatusColor: Record<JobLeadStatus, TagColor> = {
  interesting: "green",
  review: "orange",
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
    <Tag variant="status" color={leadStatusColor[status]} className={className}>
      {label}
    </Tag>
  );
}
