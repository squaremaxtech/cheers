import { getUserRow } from "@/lib/auth";
import { loadChatAccess } from "@/lib/chat-access";
import {
  isOnline,
  presenceConnect,
  presenceDisconnect,
  PRESENCE_ONLINE_WINDOW_MS,
} from "@/lib/presence";
import { publishChat, subscribeChat } from "@/lib/realtime";
import type { ChatStreamEvent } from "@/types";

// Server-Sent Events stream for a chat room — pushes each new message to
// every open participant/staff view the moment it lands. (This Next.js build
// has no WebSocket support in route handlers — SSE over a ReadableStream is
// its documented realtime channel, same as the live booking room.)
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/chat/[id]/stream">
): Promise<Response> {
  const { id } = await ctx.params;
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const access = await loadChatAccess(user, id);
  if (!access) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // Presence: participants opening the room count as online, and the other
  // side gets a live dot. Workers who hide their status are never broadcast
  // (staff never are — their reads stay invisible). Events carry the sender's
  // ROLE, never a user id (worker account ids stay off the customer client).
  const isParticipant = access.viewerRole !== "staff";
  const participantRole =
    access.viewerRole === "worker" ? ("worker" as const) : ("customer" as const);
  const broadcastPresence =
    access.viewerRole === "customer" ||
    (access.viewerRole === "worker" && access.worker.showOnlineStatus);

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ChatStreamEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribeChat(id, send);
      if (isParticipant) {
        presenceConnect(user.id);
        if (broadcastPresence) {
          publishChat(id, {
            kind: "presence",
            role: participantRole,
            online: true,
          });
        }
      }
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
        if (isParticipant) {
          presenceDisconnect(user.id);
          // They left the room stream but may still be on the site — report
          // real platform presence, not just "stream closed". Since that is
          // almost always still "online" (their activity window is fresh),
          // schedule one re-check for after the window lapses so the other
          // side's dot eventually greys out instead of sticking green.
          if (broadcastPresence) {
            const online = isOnline(user.id);
            publishChat(id, { kind: "presence", role: participantRole, online });
            if (online) {
              setTimeout(() => {
                publishChat(id, {
                  kind: "presence",
                  role: participantRole,
                  online: isOnline(user.id),
                });
              }, PRESENCE_ONLINE_WINDOW_MS + 5_000);
            }
          }
        }
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
