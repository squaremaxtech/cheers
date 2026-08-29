import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, chatRooms, users, workers } from "@/db/schema";
import { isModeratingStaff } from "@/lib/guards";
import { hasMemberAccess } from "@/lib/membership";
import type {
  ChatParticipantRole,
  ChatRoomRow,
  ChatViewerRole,
  UserRow,
} from "@/types";

export type ChatAccess = {
  room: ChatRoomRow;
  worker: {
    id: string;
    userId: string;
    stageName: string;
    slug: string;
    showOnlineStatus: boolean;
  };
  customer: { id: string; name: string | null; email: string };
  viewerRole: ChatViewerRole;
};

// Who may open a chat room: the customer, the worker, and admin/desk support
// (read-only moderation — sending is blocked for "staff" in the actions).
// Drivers and everyone else get null — callers 404 without leaking existence.
export async function loadChatAccess(
  user: UserRow,
  roomId: string
): Promise<ChatAccess | null> {
  const [row] = await db
    .select({
      room: chatRooms,
      worker: {
        id: workers.id,
        userId: workers.userId,
        stageName: workers.stageName,
        slug: workers.slug,
        showOnlineStatus: workers.showOnlineStatus,
      },
      customer: { id: users.id, name: users.name, email: users.email },
    })
    .from(chatRooms)
    .innerJoin(workers, eq(chatRooms.workerId, workers.id))
    .innerJoin(users, eq(chatRooms.customerId, users.id))
    .where(eq(chatRooms.id, roomId));
  if (!row) return null;

  const { room, worker, customer } = row;
  if (room.customerId === user.id) {
    return { room, worker, customer, viewerRole: "customer" };
  }
  if (worker.userId === user.id) {
    return { room, worker, customer, viewerRole: "worker" };
  }
  if (isModeratingStaff(user)) {
    return { room, worker, customer, viewerRole: "staff" };
  }
  return null;
}

// Which side of the room a stored message came from. Role, not user id —
// this is what ships to the client.
export function chatSenderRole(
  access: Pick<ChatAccess, "worker">,
  senderUserId: string
): ChatParticipantRole {
  return senderUserId === access.worker.userId ? "worker" : "customer";
}

// Display name attached to each message: the worker's display name (real
// name stays private) or the customer's first name.
export function chatSenderLabel(
  access: Pick<ChatAccess, "worker" | "customer">,
  senderUserId: string
): string {
  if (senderUserId === access.worker.userId) return access.worker.stageName;
  return access.customer.name?.split(" ")[0] ?? "Customer";
}

// --- The membership paywall ----------------------------------------------------

// Coordination is never paywalled: a customer with a LIVE booking with this
// worker may always message them — "here's my gate code, I'm running late"
// cannot sit behind a subscription. The CheersJA Membership buys the rest:
// opening a conversation with any professional before (or without)
// booking them.
const LIVE_BOOKING_STATUSES = [
  "pending",
  "accepted",
  "confirmed",
  "in_progress",
] as const;

export async function hasLiveBookingWith(
  customerId: string,
  workerId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.customerId, customerId),
        eq(bookings.workerId, workerId),
        inArray(bookings.status, [...LIVE_BOOKING_STATUSES])
      )
    )
    .limit(1);
  return Boolean(row);
}

// May this customer SEND into this pair's room right now? (Workers always
// may; staff never may — those rules live in the action.) Reading an
// existing room stays open even when lapsed; only the composer locks.
export async function customerCanSendChat(
  customerId: string,
  workerId: string
): Promise<boolean> {
  if (await hasMemberAccess(customerId)) return true;
  return hasLiveBookingWith(customerId, workerId);
}
