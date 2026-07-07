import Link from "next/link";
import { desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { chatRooms, users, workers } from "@/db/schema";
import { isUuid } from "@/lib/slug";

export const metadata: Metadata = { title: "Chats — Admin" };

// Staff chat moderation: find a room by its exact chat ID or by the people
// in it (worker stage name / customer name or email), then open the
// read-only transcript.
export default async function AdminChatsPage(props: PageProps<"/admin/chats">) {
  const search = await props.searchParams;
  const q = (Array.isArray(search.q) ? search.q[0] : search.q)?.trim() ?? "";
  const roomQuery =
    (Array.isArray(search.room) ? search.room[0] : search.room)?.trim() ?? "";

  let filter: SQL | undefined;
  if (roomQuery && isUuid(roomQuery)) {
    filter = eq(chatRooms.id, roomQuery);
  } else if (q) {
    filter = or(
      ilike(workers.stageName, `%${q}%`),
      ilike(users.name, `%${q}%`),
      ilike(users.email, `%${q}%`)
    );
  }

  const rows = await db
    .select({
      room: chatRooms,
      stageName: workers.stageName,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(chatRooms)
    .innerJoin(workers, eq(chatRooms.workerId, workers.id))
    .innerJoin(users, eq(chatRooms.customerId, users.id))
    .where(filter)
    .orderBy(desc(chatRooms.lastMessageAt))
    .limit(50);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Chats</h1>
      <p className="mt-1 text-sm text-muted">
        Read-only access to every customer ↔ worker conversation.
      </p>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="chats-q">
            Worker or customer
          </label>
          <input
            id="chats-q"
            name="q"
            defaultValue={q}
            placeholder="Stage name, customer name or email"
            className="input w-64 py-1.5"
          />
        </div>
        <div>
          <label className="label" htmlFor="chats-room">
            Chat ID
          </label>
          <input
            id="chats-room"
            name="room"
            defaultValue={roomQuery}
            placeholder="Exact room UUID"
            className="input w-72 py-1.5"
          />
        </div>
        <button type="submit" className="btn-gold py-2 text-xs">
          Search
        </button>
        {(q || roomQuery) && (
          <Link href="/admin/chats" className="btn-ghost py-2 text-xs">
            Clear
          </Link>
        )}
      </form>

      {roomQuery && !isUuid(roomQuery) && (
        <p className="mt-4 text-sm text-warn">
          “{roomQuery}” is not a valid chat ID — showing name/email matches
          instead.
        </p>
      )}

      <div className="card mt-6 overflow-x-auto p-2">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-faint">
              <th className="p-3">Worker</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Last message</th>
              <th className="p-3">Activity</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(({ room, stageName, customerName, customerEmail }) => (
              <tr key={room.id}>
                <td className="p-3 text-ink">{stageName}</td>
                <td className="p-3">
                  <span className="text-ink">{customerName ?? "—"}</span>
                  <span className="ml-2 text-faint">{customerEmail}</span>
                </td>
                <td className="max-w-[220px] truncate p-3 text-muted">
                  {room.lastMessagePreview ?? "No messages yet"}
                </td>
                <td className="p-3 text-muted">
                  {room.lastMessageAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="p-3">
                  <Link href={`/chats/${room.id}`} className="text-gold">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-faint">
            {q || roomQuery ? "No rooms match that search." : "No chats yet."}
          </p>
        )}
      </div>
    </div>
  );
}
