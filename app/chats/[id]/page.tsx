import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import ChatRoom from "@/components/chat/ChatRoom";
import { getUserRow } from "@/lib/auth";
import {
  chatSenderLabel,
  chatSenderRole,
  loadChatAccess,
} from "@/lib/chat-access";
import { isOnline } from "@/lib/presence";
import type { ChatMessage } from "@/types";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatRoomPage(props: PageProps<"/chats/[id]">) {
  const { id } = await props.params;
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  // Same first-login gate as the (customer) layout and the /chats inbox.
  if (user.role === "customer" && !user.onboardedAt) redirect("/welcome");

  const access = await loadChatAccess(user, id);
  if (!access) notFound();

  // Rooms are pruned to the message cap, so "all" is bounded (~1k rows).
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.roomId, access.room.id))
    .orderBy(asc(chatMessages.createdAt));
  const messages: ChatMessage[] = rows.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    senderRole: chatSenderRole(access, row.senderUserId),
    senderLabel: chatSenderLabel(access, row.senderUserId),
    kind: row.kind,
    body: row.body,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
  }));

  const counterpart =
    access.viewerRole === "worker"
      ? access.customer.name ?? "Customer"
      : access.worker.stageName;

  // Presence of the other side: customers only see a worker's status when
  // the worker allows it; workers always see customer presence; staff see
  // neither (read-only transcript).
  const counterpartOnline =
    access.viewerRole === "staff"
      ? null
      : access.viewerRole === "customer"
        ? access.worker.showOnlineStatus
          ? isOnline(access.worker.userId)
          : null
        : isOnline(access.customer.id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={access.viewerRole === "staff" ? "/admin/chats" : "/chats"}
            className="text-xs text-faint hover:text-gold"
          >
            ← All messages
          </Link>
          <h1 className="mt-1 font-display text-2xl text-ink">
            {access.viewerRole === "staff"
              ? `${access.worker.stageName} ↔ ${access.customer.name ?? access.customer.email}`
              : counterpart}
          </h1>
          {access.viewerRole === "staff" && (
            <p className="mt-1 text-xs text-faint">Chat ID: {access.room.id}</p>
          )}
        </div>
        {access.viewerRole === "customer" && (
          <Link
            href={`/workers/${access.worker.slug}`}
            className="btn-outline py-2 text-xs"
          >
            View profile
          </Link>
        )}
      </div>

      <div className="mt-6">
        <ChatRoom
          roomId={access.room.id}
          viewerRole={access.viewerRole}
          initialMessages={messages}
          counterpartLabel={counterpart}
          initialOnline={counterpartOnline}
        />
      </div>
    </div>
  );
}
