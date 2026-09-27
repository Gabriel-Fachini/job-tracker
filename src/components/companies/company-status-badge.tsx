import { Status, type StatusTone } from "@/components/ui/status";
import {
  companyStatusLabelMap,
  type CompanyStatus,
} from "@/lib/companies";

export const companyStatusTone: Record<CompanyStatus, StatusTone> = {
  monitoring: "neutral",
  in_process: "active",
  discarded: "muted",
  blacklist: "negative",
};

type CompanyStatusBadgeProps = {
  status: CompanyStatus;
  className?: string;
};

export function CompanyStatusBadge({ status, className }: CompanyStatusBadgeProps) {
  return (
    <Status tone={companyStatusTone[status]} className={className}>
      {companyStatusLabelMap[status]}
    </Status>
  );
}
