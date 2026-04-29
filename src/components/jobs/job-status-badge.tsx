import { Badge } from "@/components/ui/badge";
import { jobStatusLabelMap, type JobStatus } from "@/lib/jobs";

const statusClassNameMap: Record<JobStatus, string> = {
  interesting:
    "border-amber-400/30 bg-amber-400/12 text-amber-100 ring-1 ring-amber-300/10",
  applying:
    "border-sky-400/30 bg-sky-400/12 text-sky-100 ring-1 ring-sky-300/10",
  applied:
    "border-emerald-400/30 bg-emerald-400/12 text-emerald-100 ring-1 ring-emerald-300/10",
  discarded:
    "border-rose-400/30 bg-rose-400/12 text-rose-100 ring-1 ring-rose-300/10",
};

type JobStatusBadgeProps = {
  status: JobStatus;
};

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  return (
    <Badge variant="outline" className={statusClassNameMap[status]}>
      {jobStatusLabelMap[status]}
    </Badge>
  );
}
