"use client";

import { ChevronDown } from "lucide-react";

import { applicationStatusClassNameMap } from "@/components/applications/application-status-badge";
import {
  applicationStatusLabelMap,
  applicationStatusOptions,
  type ApplicationStatus,
} from "@/lib/applications";
import { cn } from "@/lib/utils";

type ApplicationStatusSelectProps = {
  value: ApplicationStatus;
  onChange: (status: ApplicationStatus) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Compact status pill backed by a transparent native select, so phones get
 * the system picker (and no focus zoom, since the select itself stays 16px).
 * Stops click propagation because it usually sits inside a tappable row.
 */
export function ApplicationStatusSelect({
  value,
  onChange,
  disabled,
  className,
}: ApplicationStatusSelectProps) {
  return (
    <div
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full border pr-2 pl-3 text-xs font-medium transition-colors pointer-coarse:h-9",
        "has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-ring has-[select:disabled]:opacity-60",
        applicationStatusClassNameMap[value],
        className,
      )}
    >
      <span aria-hidden>{applicationStatusLabelMap[value]}</span>
      <ChevronDown aria-hidden className="size-3.5 opacity-70" />
      <select
        aria-label="Status da candidatura"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ApplicationStatus)}
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-0 cursor-pointer appearance-none rounded-full text-base opacity-0 outline-none disabled:cursor-not-allowed [&>option]:bg-popover [&>option]:text-popover-foreground"
      >
        {applicationStatusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
