import { runTracker } from "@/lib/job-monitoring/run-state";

export const dynamic = "force-dynamic";

// deploy/deploy.sh waits while this body contains `"status":"running"`.
export async function GET() {
  return Response.json(runTracker.getSnapshot(), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
