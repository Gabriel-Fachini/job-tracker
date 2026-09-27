import { Tag, type TagColor } from "@/components/ui/tag";
import {
  companyStatusLabelMap,
  type CompanyStatus,
} from "@/lib/companies";

export const companyStatusColor: Record<CompanyStatus, TagColor> = {
  monitoring: "gray",
  in_process: "blue",
  discarded: "muted",
  blacklist: "red",
};

type CompanyStatusBadgeProps = {
  status: CompanyStatus;
  className?: string;
};

export function CompanyStatusBadge({ status, className }: CompanyStatusBadgeProps) {
  return (
    <Tag variant="status" color={companyStatusColor[status]} className={className}>
      {companyStatusLabelMap[status]}
    </Tag>
  );
}
