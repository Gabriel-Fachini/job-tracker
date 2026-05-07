import { getCurrentRun } from "@/lib/job-monitoring/run-state";

export async function GET() {
  const runState = getCurrentRun();

  if (!runState) {
    return Response.json(
      { status: "idle", run: null },
      { status: 200 },
    );
  }

  return Response.json(
    {
      status: runState.status,
      run: {
        id: runState.id,
        startedAt: runState.startedAt.toISOString(),
        endedAt: runState.endedAt?.toISOString() ?? null,
        currentCompany: runState.currentCompany,
        companyIndex: runState.companyIndex,
        totalCompanies: runState.totalCompanies,
        linksProcessed: runState.linksProcessed,
        linksTotal: runState.linksTotal,
        stats: runState.stats,
        eventCount: runState.events.length,
        lastUpdatedAt: runState.lastUpdatedAt.toISOString(),
      },
    },
    { status: 200 },
  );
}
