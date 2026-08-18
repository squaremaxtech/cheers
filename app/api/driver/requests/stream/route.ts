import { getUserRow } from "@/lib/auth";
import { driverForUser } from "@/lib/drivers";
import { subscribeDriverBoard } from "@/lib/realtime";
import type { DriverBoardStreamEvent } from "@/types";

// Server-Sent Events stream for the driver request board: "an open request
// changed — re-read the board". One global channel (every online driver
// watches the same pool); the client filters by parish locally.
//
// Auth mirrors requireBiddableDriver (actions/rides.ts): a signed-in user
// with an APPROVED, active, unsuspended driver profile. Unapproved drivers
// get nothing — the board's data comes from getOpenRideRequests, which
// enforces the same gate.
export async function GET(req: Request): Promise<Response> {
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "driver" && user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const driver = await driverForUser(user.id);
  if (!driver || !driver.verified || !driver.active || driver.suspended) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: DriverBoardStreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribeDriverBoard(send);
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
