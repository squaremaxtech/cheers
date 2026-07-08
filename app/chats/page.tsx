import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { chatRooms, users, workers } from "@/db/schema";
import InboxLive from "@/components/chat/InboxLive";
import PresenceToggle from "@/components/chat/PresenceToggle";
import { getUserRow } from "@/lib/auth";
import { isDriver } from "@/lib/guards";
import { isOnline } from "@/lib/presence";

export const metadata: Metadata = { title: "Messages" };

type InboxRow = {
  id: string;
  label: string;
  preview: string | null;
  lastMessageAt: Date;
  unread: boolean;
  online: boolean | null; // null = hidden (worker turned presence off)
};

// One rule for both sides: a room has unread mail for a viewer when its last
// message postdates that viewer's read cursor.
function isUnread(
  room: { lastMessagePreview: string | null; lastMessageAt: Date },
  cursor: Date | null
): boolean {
  return (
    room.lastMessagePreview !== null &&
    (cursor === null || cursor < room.lastMessageAt)
  );
}

// The viewer's chat inbox. Customers see their worker conversations, workers
// see their customer conversations; staff use the searchable /admin/chats.
// InboxLive re-renders this on every incoming message (SSE), so previews and
// unread dots stay current without a manual refresh.
export default async function ChatsPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role === "admin" || user.role === "support") {
    redirect(isDriver(user) ? "/driver" : "/admin/chats");
  }
  if (user.role === "customer" && !user.onboardedAt) redirect("/welcome");

  let rooms: InboxRow[];
  let workerPresence: boolean | null = null;
  if (user.role === "worker") {
    const rows = await db
      .select({
        room: chatRooms,
        customerName: users.name,
        showOnlineStatus: workers.showOnlineStatus,
      })
      .from(chatRooms)
      .innerJoin(workers, eq(chatRooms.workerId, workers.id))
      .innerJoin(users, eq(chatRooms.customerId, users.id))
      .where(eq(workers.userId, user.id))
      .orderBy(desc(chatRooms.lastMessageAt));
    rooms = rows.map(({ room, customerName }) => ({
      id: room.id,
      label: customerName ?? "Customer",
      preview: room.lastMessagePreview,
      lastMessageAt: room.lastMessageAt,
      unread: isUnread(room, room.workerLastReadAt),
      online: isOnline(room.customerId),
    }));
    if (rows.length > 0) {
      workerPresence = rows[0].showOnlineStatus;
    } else {
      const [workerRow] = await db
        .select({ showOnlineStatus: workers.showOnlineStatus })
        .from(workers)
        .where(eq(workers.userId, user.id));
      workerPresence = workerRow?.showOnlineStatus ?? null;
    }
  } else {
    const rows = await db
      .select({
        room: chatRooms,
        stageName: workers.stageName,
        workerUserId: workers.userId,
        showOnlineStatus: workers.showOnlineStatus,
      })
      .from(chatRooms)
      .innerJoin(workers, eq(chatRooms.workerId, workers.id))
      .where(eq(chatRooms.customerId, user.id))
      .orderBy(desc(chatRooms.lastMessageAt));
    rooms = rows.map(({ room, stageName, workerUserId, showOnlineStatus }) => ({
      id: room.id,
      label: stageName,
      preview: room.lastMessagePreview,
      lastMessageAt: room.lastMessageAt,
      unread: isUnread(room, room.customerLastReadAt),
      online: showOnlineStatus ? isOnline(workerUserId) : null,
    }));
  }

  return (
    <div>
      <InboxLive />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">Messages</h1>
        {workerPresence !== null && <PresenceToggle show={workerPresence} />}
      </div>
      {rooms.length === 0 ? (
        <p className="mt-6 text-sm text-faint">
          No conversations yet.{" "}
          {user.role === "worker" ? (
            "Customers can message you from your profile page."
          ) : (
            <>
              Find someone on the{" "}
              <Link href="/browse" className="text-gold">
                browse page
              </Link>{" "}
              and say hello from their profile.
            </>
          )}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/chats/${room.id}`}
                className="card flex items-center justify-between gap-4 p-4 hover:border-gold/40"
              >
                <div className="min-w-0">
                  <p
                    className={`flex items-center gap-2 text-sm ${
                      room.unread ? "font-medium text-ink" : "text-ink"
                    }`}
                  >
                    {room.unread && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-gold" />
                    )}
                    {room.label}
                    {room.online === true && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal uppercase tracking-wider text-success">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                        Online
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-faint">
                    {room.preview ?? "No messages yet"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-faint">
                  {room.lastMessageAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
