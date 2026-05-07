import { revalidatePath } from "next/cache";

import { runAllCompaniesMonitoringStream } from "@/server/actions/job-monitoring";
import type { MonitoringStreamEvent } from "@/lib/job-monitoring/types";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        function sendEvent(event: MonitoringStreamEvent) {
          const data = JSON.stringify(event);
          const message = `data: ${data}\n\n`;
          controller.enqueue(encoder.encode(message));
        }

        await runAllCompaniesMonitoringStream(sendEvent);
        controller.close();
        // Revalidate companies/applications server cache.
        // Do NOT revalidate /leads here — the client handles live updates
        // via onLeadAppended and calls router.refresh() in startTransition
        // after all-done to avoid triggering the Suspense boundary fallback.
        revalidatePath("/companies");
        revalidatePath("/applications");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`
          )
        );
        controller.close();
      }
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
