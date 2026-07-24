"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "@/lib/base-path";

// Invisible companion to the /chats inbox: refreshes the server-rendered
// list (previews, ordering, unread dots) whenever any of the viewer's rooms
// receives a message.
export default function InboxLive() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource(withBasePath("/api/chats/inbox/stream"));
    source.onmessage = () => {
      // Coalesce bursts into one refresh.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      source.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  return null;
}
