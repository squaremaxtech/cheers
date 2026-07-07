"use server";

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { chatMessages, chatRooms, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { chatSenderLabel, loadChatAccess } from "@/lib/chat-access";
import {
  CHAT_PRUNE_BATCH,
  CHAT_ROOM_MESSAGE_CAP,
} from "@/lib/constants";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { publishChat } from "@/lib/realtime";
import { removeStoredUpload } from "@/lib/uploads";
import {
  markChatReadSchema,
  openChatRoomSchema,
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

    // First message of a brand-new conversation: tell the other side someone
    // is waiting. Ongoing traffic relies on the live stream + unread badges
    // (per-message emails would be spam).
    if (total === 1) {
      const recipientUserId =
        access.viewerRole === "customer"
          ? access.worker.userId
          : access.customer.id;
      await notify({
        userId: recipientUserId,
        type: "chat_started",
        title: `New message from ${chatSenderLabel(access, user.id)}`,
        body: `"${preview}" — reply from your Messages page.`,
      });
    }

    const message: ChatMessage = {
      id: row.id,
      roomId: row.roomId,
      senderUserId: row.senderUserId,
      senderLabel: chatSenderLabel(access, row.senderUserId),
      kind: row.kind,
      body: row.body,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt.toISOString(),
    };
    publishChat(access.room.id, { kind: "message", message });

    revalidatePath("/chats");
    return ok({ message });
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
