import { getUserRow } from "@/lib/auth";
import { presenceConnect, presenceDisconnect } from "@/lib/presence";
import { subscribeInbox } from "@/lib/realtime";
import type { InboxStreamEvent } from "@/types";

// Per-user SSE stream backing the /chats inbox: fires whenever one of the
// viewer's rooms gets a new message, so unread badges update without a
// manual refresh. Sitting on the inbox also counts as being online.
export async function GET(req: Request): Promise<Response> {
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: InboxStreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribeInbox(user.id, send);
      presenceConnect(user.id);
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
        presenceDisconnect(user.id);
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
