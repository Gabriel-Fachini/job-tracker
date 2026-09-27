"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MonitoringProgress } from "@/components/leads/monitoring-run-button";
import {
  applyMonitoringStreamEvent,
  createStreamProgress,
  isFatalMonitoringError,
  progressFromSnapshot,
} from "@/lib/job-monitoring/progress-state";
import type { MonitoringRunSnapshot, MonitoringStreamEvent } from "@/lib/job-monitoring/types";

/** How often a tab without its own stream (reload, second tab) re-reads the run snapshot. */
const SNAPSHOT_POLL_INTERVAL_MS = 3_000;

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

async function fetchRunSnapshot(): Promise<MonitoringRunSnapshot> {
  const response = await fetch("/api/monitoring/current", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as MonitoringRunSnapshot;
}

function logSnapshotError(error: unknown) {
  console.error("Failed to read the monitoring run snapshot:", error);
}

export function MonitoringProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<MonitoringProgress | null>(null);
  const esRef = useRef<EventSource | null>(null);
  /** Leads saved at the last snapshot, while following a run without a stream. */
  const observedSavedRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  /** Applies a run snapshot unless this tab follows its own stream (the source of truth). */
  const applySnapshot = useCallback((snapshot: MonitoringRunSnapshot) => {
    if (esRef.current) {
      return;
    }

    if (snapshot.status === "running") {
      const run = snapshot.run;

      if (observedSavedRef.current !== null && observedSavedRef.current !== run.stats.saved) {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      }

      observedSavedRef.current = run.stats.saved;
      setProgress((prev) => progressFromSnapshot(run, prev));
      return;
    }

    if (observedSavedRef.current !== null) {
      observedSavedRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }

    setProgress((prev) =>
      prev?.isRunning ? { ...prev, isRunning: false, currentCompany: null, eventSource: null } : prev,
    );
  }, [queryClient]);

  /**
   * Settles the run state with the server when this tab has no stream to
   * follow: on mount, when a stream ends without all-done, and while polling.
   * A failed read keeps the current state; the next poll tries again.
   */
  const syncWithServer = useCallback(() => {
    fetchRunSnapshot().then(applySnapshot, logSnapshotError);
  }, [applySnapshot]);

  const attachHandlers = useCallback((es: EventSource) => {
    let receivedAllDone = false;

    function detach() {
      es.close();
      esRef.current = null;
      setProgress((prev) =>
        prev
          ? { ...prev, eventSource: null, ...(receivedAllDone ? { isRunning: false } : {}) }
          : prev,
      );
    }

    es.onmessage = (message) => {
      const parsed: MonitoringStreamEvent = JSON.parse(message.data);
      setProgress((prev) => (prev ? applyMonitoringStreamEvent(prev, parsed) : prev));

      if (parsed.type === "link-done" && parsed.decision !== "discarded") {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      }

      if (parsed.type === "all-done") {
        receivedAllDone = true;
      }

      // The run failed or another one is already going: the server says which.
      if (isFatalMonitoringError(parsed) && esRef.current === es) {
        detach();
        syncWithServer();
      }
    };

    // Fires when the server closes the stream (after all-done) or the connection drops.
    es.onerror = () => {
      if (esRef.current !== es) {
        return;
      }

      detach();

      if (!receivedAllDone) {
        syncWithServer();
      }
    };
  }, [queryClient, syncWithServer]);

  const startMonitoring = useCallback(() => {
    esRef.current?.close();
    const es = new EventSource("/api/monitoring/stream");
    esRef.current = es;
    observedSavedRef.current = null;
    setProgress(createStreamProgress(es));
    attachHandlers(es);
  }, [attachHandlers]);

  // Closing the stream cancels the run on the server.
  const cancelMonitoring = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setProgress((prev) => (prev ? { ...prev, isRunning: false, eventSource: null } : prev));
  }, []);

  useEffect(() => {
    fetchRunSnapshot().then(applySnapshot, logSnapshotError);

    return () => {
      esRef.current?.close();
    };
  }, [applySnapshot]);

  // A run this tab follows without a stream is re-read until it ends.
  const isFollowingSnapshot = Boolean(progress?.isRunning && !progress.eventSource);

  useEffect(() => {
    if (!isFollowingSnapshot) {
      return;
    }

    const interval = window.setInterval(syncWithServer, SNAPSHOT_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isFollowingSnapshot, syncWithServer]);

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
