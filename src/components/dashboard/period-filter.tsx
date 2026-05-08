"use client";

import { useRouter, useSearchParams } from "next/navigation";

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
    <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/40 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => select(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            current === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
