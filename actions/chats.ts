"use server";

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { chatMessages, chatRooms, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import {
  chatSenderLabel,
  chatSenderRole,
  loadChatAccess,
} from "@/lib/chat-access";
import {
  CHAT_NEW_ROOMS_PER_DAY,
  CHAT_PRUNE_BATCH,
  CHAT_ROOM_MESSAGE_CAP,
  CHAT_SEND_PER_MINUTE,
} from "@/lib/constants";
import { guardErrorMessage, requireUser, requireWorker } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { isOnline } from "@/lib/presence";
import { rateLimit } from "@/lib/rate-limit";
import { publishChat, publishInbox } from "@/lib/realtime";
import { removeStoredUpload } from "@/lib/uploads";
import {
  markChatReadSchema,
  openChatRoomSchema,
  presenceVisibilitySchema,
  sendChatMessageSchema,
} from "@/schemas/chat";
import type { ActionResult, ChatMessage } from "@/types";

// Customer opens (or returns to) their chat room with a worker — one room
// per pair, created on first contact from the worker's profile page.
export async function openChatRoom(
  input: unknown
): Promise<ActionResult<{ roomId: string }>> {
  try {
    const user = await requireUser();
    if (user.role !== "customer") {
      return err("Only customer accounts can start a chat with a worker.");
    }
    // Same gate as the (customer) layout and /chats: finish the /welcome
    // setup before using the account area — chat included.
    if (!user.onboardedAt) {
      return err("Finish setting up your account first — it only takes a minute.");
    }
    const parsed = openChatRoomSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [worker] = await db
      .select({
        id: workers.id,
        userId: workers.userId,
        active: workers.active,
        suspended: workers.suspended,
      })
      .from(workers)
      .where(eq(workers.id, parsed.data.workerId));
    if (!worker) return err(ERR.notFound);
    if (worker.userId === user.id) return err("You cannot message yourself.");

    // Existing conversations stay reachable even if the worker later hides
    // their profile; only STARTING a new one requires a bookable worker.
    const [existing] = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .where(
        and(
          eq(chatRooms.customerId, user.id),
          eq(chatRooms.workerId, worker.id)
        )
      );
    if (existing) return ok({ roomId: existing.id });
    if (!worker.active || worker.suspended) {
      return err("This worker is not available right now.");
    }
    // Anti-spam: cap brand-new conversations, not returning to old ones.
    if (
      !rateLimit(`chat-room:${user.id}`, CHAT_NEW_ROOMS_PER_DAY, 86_400_000)
    ) {
      return err(
        "You've started a lot of new chats today — please try again tomorrow."
      );
    }

    // Double-click / two-tab race: the unique (customer, worker) index makes
    // the second insert a no-op; re-select picks up whichever row won.
    await db
      .insert(chatRooms)
      .values({ customerId: user.id, workerId: worker.id })
      .onConflictDoNothing();
    const [room] = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .where(
        and(
          eq(chatRooms.customerId, user.id),
          eq(chatRooms.workerId, worker.id)
        )
      );
    if (!room) return err(ERR.server);
    return ok({ roomId: room.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function sendChatMessage(
  input: unknown
): Promise<ActionResult<{ message: ChatMessage }>> {
  try {
    const user = await requireUser();
    const parsed = sendChatMessageSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    }

    const access = await loadChatAccess(user, parsed.data.roomId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole === "staff") {
      return err("Support can read chats but not send messages.");
    }
    // Flood control: generous for humans, a wall for scripts.
    if (
      !rateLimit(
        `chat-send:${user.id}:${access.room.id}`,
        CHAT_SEND_PER_MINUTE,
        60_000
      )
    ) {
      return err("You're sending messages very quickly — give it a moment.");
    }
    // The image must live in THIS room's folder — not another chat's.
    if (
      parsed.data.imageUrl &&
      !parsed.data.imageUrl.startsWith(`/api/media/chat/${access.room.id}/`)
    ) {
      return err(ERR.badRequest);
    }

    const [row] = await db
      .insert(chatMessages)
      .values({
        roomId: access.room.id,
        senderUserId: user.id,
        kind: parsed.data.imageUrl ? "image" : "text",
        body: parsed.data.body,
        imageUrl: parsed.data.imageUrl ?? null,
      })
      .returning();

    // Inbox metadata + the sender's own read cursor in one write.
    const preview =
      parsed.data.body.length > 0
        ? parsed.data.body.slice(0, 140)
        : "Sent a photo";
    await db
      .update(chatRooms)
      .set({
        lastMessageAt: row.createdAt,
        lastMessagePreview: preview,
        ...(access.viewerRole === "customer"
          ? { customerLastReadAt: row.createdAt }
          : { workerLastReadAt: row.createdAt }),
      })
      .where(eq(chatRooms.id, access.room.id));

    // Cap the room: once it overflows by a batch, delete the oldest overflow
    // (new messages replace old ones ~CHAT_PRUNE_BATCH at a time) and unlink
    // any pruned image files from disk.
    const [{ n: total }] = await db
      .select({ n: count() })
      .from(chatMessages)
      .where(eq(chatMessages.roomId, access.room.id));
    if (total >= CHAT_ROOM_MESSAGE_CAP + CHAT_PRUNE_BATCH) {
      const overflow = await db
        .select({ id: chatMessages.id, imageUrl: chatMessages.imageUrl })
        .from(chatMessages)
        .where(eq(chatMessages.roomId, access.room.id))
        .orderBy(asc(chatMessages.createdAt))
        .limit(total - CHAT_ROOM_MESSAGE_CAP);
      if (overflow.length > 0) {
        await db
          .delete(chatMessages)
          .where(inArray(chatMessages.id, overflow.map((m) => m.id)));
        for (const m of overflow) {
          if (m.imageUrl) await removeStoredUpload(m.imageUrl);
        }
      }
    }

    // Notify the other side at the START of an unread burst (they were
    // caught up before this message): always record the in-app row, but only
    // send the email when they're offline — online users see it live, and
    // already-behind users were notified when their backlog started.
    const recipientUserId =
      access.viewerRole === "customer"
        ? access.worker.userId
        : access.customer.id;
    const recipientCursor =
      access.viewerRole === "customer"
        ? access.room.workerLastReadAt
        : access.room.customerLastReadAt;
    const wasCaughtUp =
      access.room.lastMessagePreview === null ||
      (recipientCursor !== null && recipientCursor >= access.room.lastMessageAt);
    if (wasCaughtUp) {
      await notify({
        userId: recipientUserId,
        type: "chat_message",
        title: `New message from ${chatSenderLabel(access, user.id)}`,
        body: `"${preview}" — reply from your Messages page.`,
        email: !isOnline(recipientUserId),
      });
    }

    const message: ChatMessage = {
      id: row.id,
      roomId: row.roomId,
      senderRole: chatSenderRole(access, row.senderUserId),
      senderLabel: chatSenderLabel(access, row.senderUserId),
      kind: row.kind,
      body: row.body,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt.toISOString(),
    };
    publishChat(access.room.id, { kind: "message", message });
    // Live unread badges on both sides' /chats pages. Deliberately NOT
    // revalidatePath: that re-renders the current route and snaps the chat
    // scroll position to the top; inbox pages listen on their own stream.
    publishInbox(recipientUserId);
    publishInbox(user.id);

    return ok({ message });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Worker preference: show/hide their "Online" dot to customers. Hiding it
// only affects display — offline-email logic still uses real presence.
export async function setChatPresenceVisibility(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = presenceVisibilitySchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    await db
      .update(workers)
      .set({ showOnlineStatus: parsed.data.show, updatedAt: new Date() })
      .where(eq(workers.id, worker.id));

    // Hiding takes effect immediately for anyone currently watching a room:
    // grey the dot now rather than waiting for their next page load. (An
    // already-open worker stream keeps its connect-time setting until it
    // reconnects — page navigation — which is at most one room-visit stale.)
    if (!parsed.data.show) {
      const rooms = await db
        .select({ id: chatRooms.id })
        .from(chatRooms)
        .where(eq(chatRooms.workerId, worker.id));
      for (const room of rooms) {
        publishChat(room.id, {
          kind: "presence",
          role: "worker",
          online: false,
        });
      }
    }

    revalidatePath("/chats");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Called when a participant has the room on screen — clears their unread
// badge. Staff have no cursor (their reads are invisible to participants).
export async function markChatRead(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = markChatReadSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const access = await loadChatAccess(user, parsed.data.roomId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole === "staff") return ok(undefined);

    await db
      .update(chatRooms)
      .set(
        access.viewerRole === "customer"
          ? { customerLastReadAt: new Date() }
          : { workerLastReadAt: new Date() }
      )
      .where(eq(chatRooms.id, access.room.id));
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
