import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { isPremiumProvider } from "@/lib/premium";
import { subscribeJobBoard } from "@/lib/realtime";
import type { JobBoardStreamEvent } from "@/types";

// Server-Sent Events stream for the worker job board: "an open request
// changed — re-read the board". One global channel (every worker watches the
// same pool); the client filters by category/parish locally.
//
// Auth mirrors sendJobOffer (actions/jobs.ts): a signed-in worker (or admin)
// whose profile is switched on and not suspended — professionals publish
// themselves, there is no approval to wait for (plan §2.1). Premium
// requests only wake premium providers, the same rail as getJobBoard.
export async function GET(req: Request): Promise<Response> {
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "worker" && user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const [worker] = await db
    .select({
      active: workers.active,
      suspended: workers.suspended,
      premiumProviderAt: workers.premiumProviderAt,
    })
    .from(workers)
    .where(eq(workers.userId, user.id));
  if (!worker || !worker.active || worker.suspended) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const premiumProvider = isPremiumProvider(worker);

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: JobBoardStreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };
      // A premium request must leave no trace on a standard board — not
      // even the timing of a refresh ping.
      const unsubscribe = subscribeJobBoard((event, premium) => {
        if (premium && !premiumProvider) return;
        send(event);
      });
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup?.();
        }
      }, 25_000);

      cleanup = () => {
        cleanup = null;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      req.signal.addEventListener("abort", () => cleanup?.());
      if (req.signal.aborted) cleanup?.();
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
