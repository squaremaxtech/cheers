"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { driverAcceptRequest, driverMakeOffer } from "@/actions/rides";
import EmptyState from "@/components/ui/EmptyState";
import { formatJamaicaDateTime } from "@/components/rides/rideUi";
import { formatDistance } from "@/components/maps/mapConfig";
import { formatCents } from "@/lib/constants";

export type BoardRequest = {
  id: string;
  code: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceM: number | null;
  offerCents: number;
  suggestedFareCents: number | null;
  scheduledAt: string | null; // ISO; null = ASAP
  createdAt: string; // ISO
  expiresAt: string; // ISO
};

// The live board of open ride requests. Requests are parish-agnostic — the
// pickup address leads each card so drivers self-filter (plus the free-text
// filter). Live refresh over the driver-board SSE stream.
export default function RequestBoard({
  requests,
}: {
  requests: BoardRequest[];
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState("");
  const [counterId, setCounterId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Live board stream ----------------------------------------------------
  useEffect(() => {
    const source = new EventSource("/api/driver/requests/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = () => {
      // Coalesce bursts (a request + its offers landing) into one refresh.
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      source.close();
    };
  }, [router]);

  const term = filter.trim().toLowerCase();
  const visible = term
    ? requests.filter((r) =>
        `${r.pickupAddress} ${r.dropoffAddress}`.toLowerCase().includes(term)
      )
    : requests;

  async function handleAccept(request: BoardRequest) {
    if (
      !window.confirm(
        `Take this ride at the rider's price — ${formatCents(request.offerCents)}, cash?`
      )
    ) {
      return;
    }
    setWorkingId(request.id);
    const res = await driverAcceptRequest({ rideId: request.id });
    setWorkingId(null);
    if (res.ok) {
      toast.success("Ride is yours — opening the ride room.");
      router.push(`/rides/${request.id}`);
    } else {
      toast.error(res.error);
      router.refresh();
    }
  }

  async function handleCounter(request: BoardRequest) {
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      toast.error("Offer at least $1.00.");
      return;
    }
    setWorkingId(request.id);
    const res = await driverMakeOffer({
      rideId: request.id,
      priceCents,
      note: note.trim() || undefined,
    });
    setWorkingId(null);
    if (res.ok) {
      toast.success("Offer sent — you'll be notified if the rider accepts.");
      setCounterId(null);
      setPrice("");
      setNote("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input sm:max-w-72"
          placeholder="Filter by area, e.g. Kingston…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span
          className={`flex items-center gap-2 text-xs ${connected ? "text-success" : "text-faint"}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-hairline"}`}
          />
          {connected ? "Live — new requests appear instantly" : "Reconnecting…"}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={term ? "Nothing matches that area" : "No open requests right now"}
          hint={
            term
              ? "Clear the filter to see every open request across Jamaica."
              : "Keep this page open — new requests appear the moment a rider posts one."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[1rem] font-medium text-ink">
                    {r.pickupAddress}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    → {r.dropoffAddress}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
                    <span>{r.code}</span>
                    <span>
                      {r.scheduledAt
                        ? `Pickup ${formatJamaicaDateTime(r.scheduledAt)}`
                        : "ASAP"}
                    </span>
                    {r.distanceM !== null && (
                      <span>~{formatDistance(r.distanceM)}</span>
                    )}
                    <span>Posted {formatJamaicaDateTime(r.createdAt)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl text-gold-deep">
                    {formatCents(r.offerCents)}
                  </p>
                  {r.suggestedFareCents !== null && (
                    <p className="text-xs text-faint">
                      suggested {formatCents(r.suggestedFareCents)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={workingId === r.id}
                  onClick={() => handleAccept(r)}
                >
                  Accept at {formatCents(r.offerCents)}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setCounterId(counterId === r.id ? null : r.id);
                    setPrice("");
                    setNote("");
                  }}
                >
                  {counterId === r.id ? "Close" : "Counter-offer"}
                </button>
              </div>

              {counterId === r.id && (
                <div className="space-y-3 rounded-xl border border-hairline bg-raised p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="label" htmlFor={`counter-${r.id}`}>
                        Your price (USD)
                      </label>
                      <input
                        id={`counter-${r.id}`}
                        type="number"
                        min={1}
                        step="0.01"
                        inputMode="decimal"
                        className="input w-32"
                        placeholder="12.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                    <div className="min-w-40 flex-1">
                      <label className="label" htmlFor={`counter-note-${r.id}`}>
                        Note (optional)
                      </label>
                      <input
                        id={`counter-note-${r.id}`}
                        className="input"
                        maxLength={300}
                        placeholder="e.g. 5 minutes away, AC"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={workingId === r.id}
                      onClick={() => handleCounter(r)}
                    >
                      {workingId === r.id ? "Sending…" : "Send offer"}
                    </button>
                  </div>
                  <p className="text-xs text-faint">
                    Sending again later updates your existing offer — the rider
                    only ever sees your latest price.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
