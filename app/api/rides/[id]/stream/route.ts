import { getUserRow } from "@/lib/auth";
import { loadRideAccess } from "@/lib/ride-access";
import { subscribeRide } from "@/lib/realtime";
import type { RideStreamEvent } from "@/types";

// Server-Sent Events stream for the live ride room. Pushes status, offer and
// location events to the rider, the matched driver and staff the moment they
// happen. (This Next.js build has no WebSocket support in route handlers —
// SSE over a ReadableStream is its documented realtime channel, same as the
// live booking room.)
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/rides/[id]/stream">
): Promise<Response> {
  const { id } = await ctx.params;
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const access = await loadRideAccess(user, id);
  if (!access) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RideStreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribeRide(id, send);
      // Reconnect quickly after network blips; proxies drop idle streams, so
      // heartbeat comments keep the connection alive.
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
      // The client may have vanished before the listener was attached.
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
