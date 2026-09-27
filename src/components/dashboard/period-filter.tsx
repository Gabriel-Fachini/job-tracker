"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import type { DashboardRange } from "@/server/queries/dashboard";

const OPTIONS: { label: string; value: DashboardRange }[] = [
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "Tudo", value: "all" },
];

interface PeriodFilterProps {
  current: DashboardRange;
}

export function PeriodFilter({ current }: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(value: DashboardRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <SegmentedControl aria-label="Período" className="w-full sm:w-auto">
      {OPTIONS.map((opt) => (
        <SegmentedControlItem
          key={opt.value}
          pressed={current === opt.value}
          onClick={() => select(opt.value)}
          className="flex-1 sm:flex-none"
        >
          {opt.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
