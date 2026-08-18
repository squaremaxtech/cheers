"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The realtime heart of the ride room: subscribes to the ride's SSE stream
// and refreshes the server-rendered page when anything changes (status moves,
// offers landing/withdrawing). Lighter than BookingLive — no map state here,
// every event is a "re-read the room" signal.
export default function RideLive({
  rideId,
  terminal,
}: {
  rideId: string;
  // completed/cancelled/expired: nothing can change — don't hold a stream open
  terminal: boolean;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (terminal) return;
    const source = new EventSource(`/api/rides/${rideId}/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = () => {
      // A short coalesce collapses event bursts into one refresh.
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      source.close();
    };
  }, [rideId, router, terminal]);

  if (terminal) return null;

  return (
    <p
      className={`flex items-center gap-2 text-xs ${connected ? "text-success" : "text-faint"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-hairline"}`}
      />
      {connected ? "Live — updates appear instantly" : "Reconnecting…"}
    </p>
  );
}
