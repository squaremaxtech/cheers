import { getUserRow } from "@/lib/auth";
import { isSafetyDesk } from "@/lib/guards";
import { subscribeSafetyDesk } from "@/lib/realtime";
import type { SafetyDeskStreamEvent } from "@/types";

// Live feed for the safety desk board. One global channel: the desk watches
// every session at once, so any safety change tells it to re-read the board.
//
// Same SSE approach as the booking room — this Next build has no WebSocket
// support in route handlers, and SSE is its documented realtime channel.
export async function GET(req: Request): Promise<Response> {
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isSafetyDesk(user)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SafetyDeskStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribeSafetyDesk(send);
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
