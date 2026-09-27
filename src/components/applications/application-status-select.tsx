"use client";

import { ChevronDown } from "lucide-react";

import { applicationStatusTone } from "@/components/applications/application-status-badge";
import { StatusDot } from "@/components/ui/status";
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
 * Compact status control backed by a transparent native select, so phones get
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
        "relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-field px-2 text-xs font-medium whitespace-nowrap text-foreground transition-[border-color,box-shadow] duration-150 pointer-coarse:h-9 pointer-coarse:px-2.5",
        "has-[select:focus-visible]:border-ring has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-ring/25 has-[select:disabled]:opacity-50",
        className,
      )}
    >
      <StatusDot tone={applicationStatusTone[value]} />
      <span aria-hidden>{applicationStatusLabelMap[value]}</span>
      <ChevronDown aria-hidden className="size-3 shrink-0 text-subtle-foreground" />
      <select
        aria-label="Status da candidatura"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ApplicationStatus)}
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-0 cursor-pointer appearance-none rounded-lg text-base opacity-0 outline-none disabled:cursor-not-allowed [&>option]:bg-popover [&>option]:text-popover-foreground"
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
