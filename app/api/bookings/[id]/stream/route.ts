import { getUserRow } from "@/lib/auth";
import { loadBookingAccess } from "@/lib/booking-access";
import { subscribeBooking } from "@/lib/realtime";
import type { BookingStreamEvent } from "@/types";

// Server-Sent Events stream for the live booking room. Pushes status,
// payment, wellness, alert and location events to every participant the
// moment they happen. (This Next.js build has no WebSocket support in route
// handlers — SSE over a ReadableStream is its documented realtime channel.)
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/bookings/[id]/stream">
): Promise<Response> {
  const { id } = await ctx.params;
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const access = await loadBookingAccess(user, id);
  if (!access) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: BookingStreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribeBooking(id, send);
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
