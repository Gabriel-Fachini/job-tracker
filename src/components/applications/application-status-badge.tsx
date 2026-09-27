import { Status, type StatusTone } from "@/components/ui/status";
import {
  applicationStatusLabelMap,
  type ApplicationStatus,
} from "@/lib/applications";

export const applicationStatusTone: Record<ApplicationStatus, StatusTone> = {
  applied: "neutral",
  in_process: "active",
  offer: "positive",
  approved: "positive",
  rejected: "negative",
  withdrawn: "muted",
};

type ApplicationStatusBadgeProps = {
  status: ApplicationStatus;
};

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  return (
    <Status tone={applicationStatusTone[status]}>
      {applicationStatusLabelMap[status]}
    </Status>
  );
}
