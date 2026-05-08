"use client";

import dynamic from "next/dynamic";

// Prevent SSR of Recharts components — server has no DOM dimensions,
// causing ResponsiveContainer to fire width/height warnings on every render.
export const RadarTimelineWidget = dynamic(
  () =>
    import("./radar-timeline-widget").then((m) => ({
      default: m.RadarTimelineWidget,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
        <div className="mt-4" style={{ aspectRatio: "4 / 1" }} />
      </div>
    ),
  },
);

export const ClassificationWidget = dynamic(
  () =>
    import("./classification-widget").then((m) => ({
      default: m.ClassificationWidget,
    })),
  { ssr: false },
);
