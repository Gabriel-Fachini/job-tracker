import { Badge } from "@/components/ui/badge";
import {
  applicationStatusLabelMap,
  type ApplicationStatus,
} from "@/lib/applications";

const statusClassNameMap: Record<ApplicationStatus, string> = {
  applied:
    "border-sky-400/30 bg-sky-400/12 text-sky-100 ring-1 ring-sky-300/10",
  in_process:
    "border-violet-400/30 bg-violet-400/12 text-violet-100 ring-1 ring-violet-300/10",
  offer:
    "border-emerald-400/30 bg-emerald-400/12 text-emerald-100 ring-1 ring-emerald-300/10",
  approved:
    "border-green-400/30 bg-green-400/12 text-green-100 ring-1 ring-green-300/10",
  rejected:
    "border-rose-400/30 bg-rose-400/12 text-rose-100 ring-1 ring-rose-300/10",
  withdrawn:
    "border-zinc-400/30 bg-zinc-400/12 text-zinc-300 ring-1 ring-zinc-300/10",
};

type ApplicationStatusBadgeProps = {
  status: ApplicationStatus;
};

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  return (
    <Badge variant="outline" className={statusClassNameMap[status]}>
      {applicationStatusLabelMap[status]}
    </Badge>
  );
}
