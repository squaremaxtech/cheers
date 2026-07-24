"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookingRouteMap, {
  type MapParticipant,
} from "@/components/maps/BookingRouteMap";
import { parseLatLng, type LatLng } from "@/components/maps/mapConfig";
import type { BookingStreamEvent, BookingViewerRole } from "@/types";

const LOCATION_SEND_MS = 5000;

const roleMarkers: Record<string, { label: string; title: string }> = {
  customer: { label: "C", title: "Customer" },
  worker: { label: "W", title: "Worker" },
  driver: { label: "D", title: "Driver" },
  staff: { label: "S", title: "Support" },
};

type LiveLocation = {
  userId: string;
  role: string;
  lat: string;
  lng: string;
  updatedAt: string;
};

// The realtime heart of the booking room: subscribes to the booking's SSE
// stream, refreshes server-rendered sections when anything changes, shows the
// live map, and (optionally) shares the viewer's own position while the
// booking is active.
export default function BookingLive({
  bookingId,
  viewerRole,
  active,
  terminal,
  destination,
  initialLocations,
  selfUserId,
}: {
  bookingId: string;
  viewerRole: BookingViewerRole;
  // confirmed/in_progress: location sharing and the live map are relevant
  active: boolean;
  // completed/declined/cancelled/refunded: nothing can change — no stream
  terminal: boolean;
  destination: { lat: string | null; lng: string | null };
  initialLocations: LiveLocation[];
  selfUserId: string;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [locations, setLocations] = useState<LiveLocation[]>(initialLocations);
  const [sharing, setSharing] = useState(false);
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const lastSentRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- SSE subscription ----------------------------------------------------
  useEffect(() => {
    // Finished bookings can't emit events — don't hold a stream open.
    if (terminal) return;
    const source = new EventSource(`/api/bookings/${bookingId}/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (msg) => {
      let event: BookingStreamEvent;
      try {
        event = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (event.kind === "location") {
        setLocations((prev) => {
          const next = prev.filter((l) => l.userId !== event.userId);
          next.push({
            userId: event.userId,
            role: event.role,
            lat: event.lat,
            lng: event.lng,
            updatedAt: event.at,
          });
          return next;
        });
      } else {
        // Status/payment/wellness/alert changes re-render the server
        // sections; a short coalesce collapses event bursts into one refresh.
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => router.refresh(), 300);
      }
    };
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      source.close();
    };
  }, [bookingId, router, terminal]);

  // --- Own location sharing --------------------------------------------------
  const stopSharing = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
  }, []);

  const startSharing = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPosition(point);
        const now = Date.now();
        if (now - lastSentRef.current < LOCATION_SEND_MS) return;
        lastSentRef.current = now;
        fetch(`/api/bookings/${bookingId}/location`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(point),
        }).catch(() => {
          // transient network failure — next ping retries
        });
      },
      () => setSharing(false),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }, [bookingId]);

  useEffect(() => stopSharing, [stopSharing]);

  const dest = parseLatLng(destination.lat, destination.lng);
  const participants: MapParticipant[] = locations
    .filter((l) => l.userId !== selfUserId)
    .flatMap((l) => {
      const position = parseLatLng(l.lat, l.lng);
      if (!position) return [];
      const marker = roleMarkers[l.role] ?? { label: "•", title: l.role };
      return [{ key: l.userId, position, ...marker }];
    });

  return (
    <div className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Live tracking
        </h2>
        {!terminal && (
          <span
            className={`flex items-center gap-2 text-xs ${connected ? "text-success" : "text-faint"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-hairline"}`}
            />
            {connected ? "Live — updates appear instantly" : "Reconnecting…"}
          </span>
        )}
      </div>

      <BookingRouteMap
        destination={dest}
        participants={participants}
        origin={myPosition}
      />

      {active && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={sharing ? "btn-outline" : "btn-gold"}
            onClick={sharing ? stopSharing : startSharing}
          >
            {sharing ? "Stop sharing my location" : "Share my location"}
          </button>
          <p className="text-xs text-faint">
            {sharing
              ? "Everyone on this booking can see your position."
              : viewerRole === "worker" || viewerRole === "driver"
                ? "Share while travelling so the team can follow your progress."
                : "Share so your worker can find you faster."}
          </p>
        </div>
      )}

      {participants.length === 0 && (
        <p className="text-xs text-faint">
          No one else is sharing their location right now.
        </p>
      )}
    </div>
  );
}
