"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Prevent SSR of Recharts components: the server has no DOM dimensions,
// so ResponsiveContainer fires width/height warnings on every render.

/** Stand-in for a chart cell of the dashboard panel grid while it loads. */
function ChartCellPlaceholder({
  className,
  plotClassName,
}: {
  className?: string;
  plotClassName: string;
}) {
  return (
    <div aria-hidden className={cn("flex min-w-0 flex-col bg-background", className)}>
      <div className="flex min-h-11 items-center border-b border-border px-4 py-2.5 sm:px-5">
        <Skeleton className="h-3.5 w-36" />
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className={plotClassName} />
      </div>
    </div>
  );
}

export const RadarTimelineWidget = dynamic(
  () =>
    import("./radar-timeline-widget").then((m) => ({
      default: m.RadarTimelineWidget,
    })),
  {
    ssr: false,
    loading: () => (
      <ChartCellPlaceholder className="lg:col-span-2" plotClassName="h-48 lg:h-56" />
    ),
  },
);

export const ClassificationWidget = dynamic(
  () =>
    import("./classification-widget").then((m) => ({
      default: m.ClassificationWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartCellPlaceholder plotClassName="h-56" />,
  },
);
