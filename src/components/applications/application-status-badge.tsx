import { Tag, type TagColor } from "@/components/ui/tag";
import {
  applicationStatusLabelMap,
  type ApplicationStatus,
} from "@/lib/applications";

export const applicationStatusColor: Record<ApplicationStatus, TagColor> = {
  applied: "gray",
  in_process: "blue",
  offer: "purple",
  approved: "green",
  rejected: "red",
  withdrawn: "muted",
};

type ApplicationStatusBadgeProps = {
  status: ApplicationStatus;
};

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  return (
    <Tag variant="status" color={applicationStatusColor[status]}>
      {applicationStatusLabelMap[status]}
    </Tag>
  );
}
