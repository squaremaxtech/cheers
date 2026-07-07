"use client";

import type { TimeSlot } from "@/types";

// Grid of a worker's start times for one day. Available slots are clickable;
// pending (another customer is mid-booking) and booked slots are disabled.
export default function TimeSlotPicker({
  slots,
  loading,
  dateSelected,
  value,
  onSelect,
}: {
  slots: TimeSlot[] | null;
  loading: boolean;
  dateSelected: boolean;
  value: string;
  onSelect: (time: string) => void;
}) {
  if (!dateSelected) {
    return <p className="text-sm text-faint">Pick a date to see open times.</p>;
  }
  if (loading && !slots) {
    return <p className="text-sm text-faint">Checking availability…</p>;
  }
  if (!slots || slots.length === 0) {
    return (
      <p className="text-sm text-muted">
        No open times on this date — try another day.
      </p>
    );
  }

  return (
    <div>
      <div
        className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${loading ? "opacity-60" : ""}`}
      >
        {slots.map((slot) => {
          const selected = slot.state === "available" && value === slot.time;
          const base =
            "rounded-xl border px-2 py-2 text-center text-sm transition-colors";
          if (slot.state === "available") {
            return (
              <button
                key={slot.time}
                type="button"
                onClick={() => onSelect(slot.time)}
                className={`${base} cursor-pointer ${
                  selected
                    ? "border-gold/70 bg-gold text-base font-medium"
                    : "border-hairline text-ink hover:border-gold/40"
                }`}
              >
                {slot.time}
              </button>
            );
          }
          return (
            <span
              key={slot.time}
              className={`${base} cursor-not-allowed border-hairline/60 text-faint line-through`}
              title={
                slot.state === "booked"
                  ? "Already booked"
                  : "Another customer is booking this time"
              }
            >
              {slot.time}
            </span>
          );
        })}
      </div>
      {slots.some((s) => s.state === "pending") && (
        <p className="mt-2 text-xs text-faint">
          Crossed-out times are booked or on hold by another customer — holds
          free up if their request isn&apos;t completed.
        </p>
      )}
    </div>
  );
}
