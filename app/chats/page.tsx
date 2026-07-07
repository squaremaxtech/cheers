import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { chatRooms, users, workers } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { isDriver } from "@/lib/guards";

export const metadata: Metadata = { title: "Messages" };

type InboxRow = {
  id: string;
  label: string;
  preview: string | null;
  lastMessageAt: Date;
  unread: boolean;
};

// The viewer's chat inbox. Customers see their worker conversations, workers
// see their customer conversations; staff use the searchable /admin/chats.
export default async function ChatsPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role === "admin" || user.role === "support") {
    redirect(isDriver(user) ? "/driver" : "/admin/chats");
  }
  if (user.role === "customer" && !user.onboardedAt) redirect("/welcome");

  let rooms: InboxRow[];
  if (user.role === "worker") {
    const rows = await db
      .select({ room: chatRooms, customerName: users.name })
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
      unread:
        room.lastMessagePreview !== null &&
        (room.workerLastReadAt === null ||
          room.workerLastReadAt < room.lastMessageAt),
    }));
  } else {
    const rows = await db
      .select({ room: chatRooms, stageName: workers.stageName })
      .from(chatRooms)
      .innerJoin(workers, eq(chatRooms.workerId, workers.id))
      .where(eq(chatRooms.customerId, user.id))
      .orderBy(desc(chatRooms.lastMessageAt));
    rooms = rows.map(({ room, stageName }) => ({
      id: room.id,
      label: stageName,
      preview: room.lastMessagePreview,
      lastMessageAt: room.lastMessageAt,
      unread:
        room.lastMessagePreview !== null &&
        (room.customerLastReadAt === null ||
          room.customerLastReadAt < room.lastMessageAt),
    }));
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Messages</h1>
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
                    className={`text-sm ${
                      room.unread ? "font-medium text-ink" : "text-ink"
                    }`}
                  >
                    {room.unread && (
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold align-middle" />
                    )}
                    {room.label}
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
