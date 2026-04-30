import { Badge } from "@/components/ui/badge";
import {
  companyStatusLabelMap,
  type CompanyStatus,
} from "@/lib/companies";

const companyStatusClassNameMap: Record<CompanyStatus, string> = {
  monitoring:
    "border-zinc-400/30 bg-zinc-400/10 text-zinc-100 ring-1 ring-zinc-300/10",
  in_process:
    "border-emerald-400/30 bg-emerald-400/12 text-emerald-100 ring-1 ring-emerald-300/10",
  discarded:
    "border-amber-400/30 bg-amber-400/12 text-amber-100 ring-1 ring-amber-300/10",
  blacklist:
    "border-rose-400/30 bg-rose-400/12 text-rose-100 ring-1 ring-rose-300/10",
};

type CompanyStatusBadgeProps = {
  status: CompanyStatus;
};

export function CompanyStatusBadge({ status }: CompanyStatusBadgeProps) {
  return (
    <Badge variant="outline" className={companyStatusClassNameMap[status]}>
      {companyStatusLabelMap[status]}
    </Badge>
  );
}
