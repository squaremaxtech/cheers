"use client";

import toast from "react-hot-toast";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import type { NotificationRow } from "@/types";

export default function NotificationsList({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  if (notifications.length === 0) {
    return <p className="text-sm text-faint">Nothing yet.</p>;
  }

  const hasUnread = notifications.some((n) => n.readAt === null);

  return (
    <div>
      {hasUnread && (
        <button
          type="button"
          className="mb-3 text-xs text-gold hover:text-gold-soft"
          onClick={async () => {
            const res = await markAllNotificationsRead();
            if (!res.ok) toast.error(res.error);
          }}
        >
          Mark all read
        </button>
      )}
      <ul className="divide-y divide-hairline">
        {notifications.map((n) => (
          <li key={n.id} className="py-3">
            <button
              type="button"
              className="w-full text-left"
              onClick={() => {
                if (n.readAt === null) markNotificationRead(n.id);
              }}
            >
              <p
                className={`text-sm ${
                  n.readAt === null ? "font-medium text-ink" : "text-muted"
                }`}
              >
                {n.readAt === null && (
                  <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-gold align-middle" />
                )}
                {n.title}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-faint">{n.body}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
