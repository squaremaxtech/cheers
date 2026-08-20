import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobRequests } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { isModeratingStaff } from "@/lib/guards";
import { subscribeJobRequest } from "@/lib/realtime";
import type { JobRequestStreamEvent } from "@/types";

// Server-Sent Events stream for one job request: the customer's request room
// re-renders when an offer lands or the lifecycle moves. Admits the request's
// customer and moderating staff only — workers follow it from the board.
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/jobs/[id]/stream">
): Promise<Response> {
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const [request] = await db
    .select({ customerId: jobRequests.customerId })
    .from(jobRequests)
    .where(eq(jobRequests.id, id));
  if (!request) return Response.json({ error: "not found" }, { status: 404 });
  if (request.customerId !== user.id && !isModeratingStaff(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: JobRequestStreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribeJobRequest(id, send);
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
