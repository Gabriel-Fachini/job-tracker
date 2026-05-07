export type MonitoringEvent = {
  type:
    | "start"
    | "company-start"
    | "link-done"
    | "company-done"
    | "all-done"
    | "error";
  timestamp: Date;
  data?: Record<string, unknown>;
};

export type RunState = {
  id: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: Date;
  endedAt: Date | null;
  currentCompany: string | null;
  companyIndex: number;
  totalCompanies: number;
  linksProcessed: number;
  linksTotal: number;
  events: MonitoringEvent[];
  lastUpdatedAt: Date;
  stats: {
    saved: number;
    review: number;
    discarded: number;
    failed: number;
  };
};

let currentRun: RunState | null = null;

export function startRun(id: string, totalCompanies: number): RunState {
  currentRun = {
    id,
    status: "running",
    startedAt: new Date(),
    endedAt: null,
    currentCompany: null,
    companyIndex: 0,
    totalCompanies,
    linksProcessed: 0,
    linksTotal: 0,
    events: [],
    lastUpdatedAt: new Date(),
    stats: {
      saved: 0,
      review: 0,
      discarded: 0,
      failed: 0,
    },
  };

  appendEvent({
    type: "start",
    timestamp: currentRun.startedAt,
    data: { totalCompanies },
  });

  return currentRun;
}

export function appendEvent(event: MonitoringEvent): void {
  if (!currentRun) {
    return;
  }

  currentRun.events.push(event);
  currentRun.lastUpdatedAt = new Date();

  if (event.type === "company-start") {
    currentRun.currentCompany = event.data?.company as string;
    currentRun.companyIndex = (event.data?.index as number) ?? 0;
  }

  if (event.type === "link-done") {
    currentRun.linksProcessed++;
    const stat = event.data?.stat as keyof RunState["stats"];
    if (stat && stat in currentRun.stats) {
      currentRun.stats[stat]++;
    }
  }

  if (event.type === "company-done") {
    currentRun.linksTotal += event.data?.linksCount as number;
  }

  if (event.type === "all-done") {
    currentRun.status = "completed";
    currentRun.endedAt = new Date();
    currentRun.currentCompany = null;
  }

  if (event.type === "error") {
    currentRun.status = "failed";
    currentRun.endedAt = new Date();
  }
}

export function getCurrentRun(): RunState | null {
  return currentRun;
}

export function finishRun(): void {
  if (!currentRun) {
    return;
  }

  if (currentRun.status === "running") {
    currentRun.status = "cancelled";
    currentRun.endedAt = new Date();
  }

  currentRun = null;
}

export function setRunStats(stats: Partial<RunState["stats"]>): void {
  if (!currentRun) {
    return;
  }

  currentRun.stats = {
    ...currentRun.stats,
    ...stats,
  };
  currentRun.lastUpdatedAt = new Date();
}

export function updateRunProgress(
  companyIndex: number,
  totalCompanies: number,
  linksProcessed: number,
  linksTotal: number,
): void {
  if (!currentRun) {
    return;
  }

  currentRun.companyIndex = companyIndex;
  currentRun.totalCompanies = totalCompanies;
  currentRun.linksProcessed = linksProcessed;
  currentRun.linksTotal = linksTotal;
  currentRun.lastUpdatedAt = new Date();
}
