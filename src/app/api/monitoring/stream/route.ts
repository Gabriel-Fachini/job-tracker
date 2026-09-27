import { revalidatePath } from "next/cache";

import { runAllCompaniesMonitoringStream } from "@/server/actions/job-monitoring";
import type { MonitoringStreamEvent } from "@/lib/job-monitoring/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  // Closing the EventSource (Cancelar, closing or reloading the tab) cancels the run.
  const disconnect = new AbortController();
  const abortRun = () => disconnect.abort();
  request.signal.addEventListener("abort", abortRun, { once: true });
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Never throws into the radar: once the client is gone, events are dropped.
      function sendEvent(event: MonitoringStreamEvent) {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
          abortRun();
        }
      }

      try {
        await runAllCompaniesMonitoringStream(sendEvent, { signal: disconnect.signal });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        sendEvent({ type: "error", message, fatal: true });
      } finally {
        request.signal.removeEventListener("abort", abortRun);

        if (!closed) {
          closed = true;
          controller.close();
        }
      }

      // Revalidate the companies/applications server cache. /leads is left out
      // on purpose: the client refetches leads through TanStack Query
      // (invalidateQueries on link-done), and revalidating it would trigger the
      // page's Suspense fallback.
      try {
        revalidatePath("/companies");
        revalidatePath("/applications");
      } catch (error) {
        console.warn("[job-monitoring] revalidate after stream failed", error);
      }
    },
    cancel() {
      closed = true;
      abortRun();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
