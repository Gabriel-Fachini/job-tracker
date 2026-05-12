"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MonitoringProgress, MonitoringProgressEvent } from "@/components/leads/monitoring-run-button";
import type { MonitoringStreamEvent } from "@/lib/job-monitoring/types";

type MonitoringActions = {
  startMonitoring: () => void;
  cancelMonitoring: () => void;
};

type MonitoringProgressContextValue = {
  progress: MonitoringProgress | null;
  actions: MonitoringActions;
};

const MonitoringProgressContext = createContext<MonitoringProgressContextValue>({
  progress: null,
  actions: { startMonitoring: () => {}, cancelMonitoring: () => {} },
});

function toProgressEvent(parsed: MonitoringStreamEvent): MonitoringProgressEvent | null {
  const id = `${parsed.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();
  switch (parsed.type) {
    case "company-start":
      return { id, timestamp, type: "company-start", message: `Buscando em ${parsed.company}`, detail: `Empresa ${parsed.index} de ${parsed.total}` };
    case "link-done":
      return { id, timestamp, type: "link-done", message: parsed.title, detail: parsed.decision };
    case "company-done":
      return { id, timestamp, type: "company-done", message: `${parsed.company} concluído` };
    case "error":
      return { id, timestamp, type: "error", message: parsed.message };
    default:
      return null;
  }
}

function applySSEEvent(prev: MonitoringProgress, parsed: MonitoringStreamEvent): MonitoringProgress {
  const progressEvent = toProgressEvent(parsed);
  const newEvents = progressEvent ? [progressEvent, ...prev.events] : prev.events;

  switch (parsed.type) {
    case "start":
      return { ...prev, isRunning: true, totalCompanies: parsed.total, events: newEvents };
    case "company-start":
      return {
        ...prev,
        currentCompany: parsed.company,
        companyIndex: parsed.index,
        totalCompanies: parsed.total,
        linksProcessed: 0,
        linksTotal: 0,
        events: newEvents,
      };
    case "link-processing":
      return { ...prev, linksProcessed: parsed.processed, linksTotal: parsed.total, events: newEvents };
    case "link-done": {
      const newStats = { ...prev.stats };
      if (parsed.decision === "interesting") newStats.leadsSaved++;
      else if (parsed.decision === "review") newStats.reviewsSaved++;
      else if (parsed.decision === "discarded") newStats.discarded++;
      else newStats.failed++;
      return { ...prev, linksProcessed: parsed.processed, linksTotal: parsed.total, stats: newStats, events: newEvents };
    }
    case "company-done":
      return { ...prev, events: newEvents };
    case "all-done":
      return {
        ...prev,
        isRunning: false,
        currentCompany: null,
        stats: {
          leadsSaved: parsed.summary.leadsSaved,
          reviewsSaved: parsed.summary.reviewsSaved,
          discarded: parsed.summary.discarded,
          failed: parsed.summary.failed,
        },
        events: newEvents,
      };
    case "error":
      return { ...prev, isRunning: false, events: newEvents };
    default:
      return prev;
  }
}

export function MonitoringProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<MonitoringProgress | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  const attachHandlers = useCallback((es: EventSource) => {
    es.onmessage = (event) => {
      const parsed: MonitoringStreamEvent = JSON.parse(event.data);
      setProgress((prev) => (prev ? applySSEEvent(prev, parsed) : prev));

      if (parsed.type === "link-done" && parsed.decision !== "discarded") {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
      setProgress((prev) => (prev ? { ...prev, isRunning: false, eventSource: null } : prev));
    };
  }, [queryClient]);

  const startMonitoring = useCallback(() => {
    esRef.current?.close();
    const es = new EventSource("/api/monitoring/stream");
    esRef.current = es;
    setProgress({
      isRunning: true,
      currentCompany: null,
      companyIndex: 0,
      totalCompanies: 0,
      linksProcessed: 0,
      linksTotal: 0,
      events: [],
      stats: { leadsSaved: 0, reviewsSaved: 0, discarded: 0, failed: 0 },
      result: null,
      eventSource: es,
    });
    attachHandlers(es);
  }, [attachHandlers]);

  const cancelMonitoring = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setProgress((prev) => (prev ? { ...prev, isRunning: false, eventSource: null } : prev));
  }, []);

  useEffect(() => {
    async function hydrate() {
      try {
        const response = await fetch("/api/monitoring/current");
        const data = await response.json();

        if (data.status === "running" && data.run) {
          const run = data.run;
          setProgress({
            isRunning: true,
            currentCompany: run.currentCompany,
            companyIndex: run.companyIndex,
            totalCompanies: run.totalCompanies,
            linksProcessed: run.linksProcessed,
            linksTotal: run.linksTotal,
            events: [],
            stats: {
              leadsSaved: run.stats.saved,
              reviewsSaved: run.stats.review,
              discarded: run.stats.discarded,
              failed: run.stats.failed,
            },
            result: null,
            eventSource: null,
          });
        }
      } catch (error) {
        console.error("Failed to hydrate monitoring progress:", error);
      }
    }

    hydrate();

    return () => {
      esRef.current?.close();
    };
  }, []);

  return (
    <MonitoringProgressContext.Provider
      value={{
        progress,
        actions: { startMonitoring, cancelMonitoring },
      }}
    >
      {children}
    </MonitoringProgressContext.Provider>
  );
}

export function useMonitoringProgress(): MonitoringProgress | null {
  return useContext(MonitoringProgressContext).progress;
}

export function useMonitoringActions(): MonitoringActions {
  return useContext(MonitoringProgressContext).actions;
}
