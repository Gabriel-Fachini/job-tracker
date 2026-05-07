"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { MonitoringProgress } from "@/components/leads/monitoring-run-button";

type MonitoringProgressContextValue = MonitoringProgress | null;

const MonitoringProgressContext =
  createContext<MonitoringProgressContextValue | null>(null);

export function MonitoringProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [progress, setProgress] = useState<MonitoringProgress | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    async function hydrate() {
      try {
        const response = await fetch("/api/monitoring/current");
        const data = await response.json();

        if (data.status === "running" && data.run) {
          const runSnapshot = data.run;
          const eventSource = new EventSource("/api/monitoring/stream");

          const newProgress: MonitoringProgress = {
            isRunning: true,
            currentCompany: runSnapshot.currentCompany,
            companyIndex: runSnapshot.companyIndex,
            totalCompanies: runSnapshot.totalCompanies,
            linksProcessed: runSnapshot.linksProcessed,
            linksTotal: runSnapshot.linksTotal,
            events: [],
            stats: runSnapshot.stats,
            result: null,
            eventSource,
          };

          setProgress(newProgress);

          eventSource.onmessage = (event) => {
            const parsed = JSON.parse(event.data);
            setProgress((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                events: [...prev.events, parsed],
                isRunning: parsed.type !== "all-done" && parsed.type !== "error",
              };
            });
          };

          eventSource.onerror = () => {
            eventSource.close();
            setProgress((prev) => (prev ? { ...prev, isRunning: false } : prev));
          };
        }
      } catch (error) {
        console.error("Failed to hydrate monitoring progress:", error);
      }
    }

    hydrate();

    return () => {
      if (progress?.eventSource) {
        progress.eventSource.close();
      }
    };
  }, []);

  return (
    <MonitoringProgressContext.Provider value={mounted ? progress : null}>
      {children}
    </MonitoringProgressContext.Provider>
  );
}

export function useMonitoringProgress(): MonitoringProgressContextValue {
  return useContext(MonitoringProgressContext);
}
