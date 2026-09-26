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
    <div
      role="group"
      aria-label="Período"
      className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border/60 bg-card/50 p-1 sm:flex sm:w-auto sm:items-center"
    >
      {OPTIONS.map((opt) => {
        const isActive = current === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => select(opt.value)}
            className={`h-8 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-9 ${
              isActive
                ? "bg-foreground/12 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
