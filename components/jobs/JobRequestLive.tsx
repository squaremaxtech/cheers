"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Keeps the customer's request room current: subscribes to the request's SSE
// channel and re-renders server data when an offer lands or the lifecycle
// moves. Terminal requests don't subscribe (nothing more will happen).
export default function JobRequestLive({
  jobRequestId,
  terminal,
}: {
  jobRequestId: string;
  terminal: boolean;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (terminal) return;
    const source = new EventSource(`/api/jobs/${jobRequestId}/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = () => {
      // Coalesce bursts (several offers in a second) into one refresh.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      source.close();
    };
  }, [jobRequestId, terminal, router]);

  if (terminal) return null;
  return (
    <span
      className={`flex items-center gap-2 text-xs ${connected ? "text-success" : "text-faint"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-hairline"}`}
      />
      {connected ? "Live" : "Reconnecting…"}
    </span>
  );
}
