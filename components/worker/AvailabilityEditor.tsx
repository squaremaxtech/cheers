"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  addAvailabilityException,
  removeAvailabilityException,
  setWeeklyAvailability,
} from "@/actions/worker";
import type { AvailabilityRow } from "@/types";

type ExceptionRow = {
  id: string;
  date: string;
  available: boolean;
  note: string | null;
};

type Slot = { dayOfWeek: number; startTime: string; endTime: string };

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AvailabilityEditor({
  slots,
  exceptions,
}: {
  slots: AvailabilityRow[];
  exceptions: ExceptionRow[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Slot[]>(
    slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime.slice(0, 5),
      endTime: s.endTime.slice(0, 5),
    }))
  );
  const [busy, setBusy] = useState(false);

  function updateSlot(index: number, patch: Partial<Slot>) {
    setDraft((d) => d.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function saveWeekly() {
    setBusy(true);
    const res = await setWeeklyAvailability({ slots: draft });
    setBusy(false);
    if (res.ok) {
      toast.success("Weekly schedule saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleBlockDate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture before await: React nulls currentTarget after the sync phase.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const res = await addAvailabilityException({
      date: form.get("date"),
      available: false,
      note: form.get("note") || undefined,
    });
    if (res.ok) {
      toast.success("Date blocked");
      formEl.reset();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-8">
      {/* Weekly schedule */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Weekly hours
          </h2>
          <button
            type="button"
            className="btn-outline text-xs"
            onClick={() =>
              setDraft((d) => [
                ...d,
                { dayOfWeek: 5, startTime: "18:00", endTime: "23:00" },
              ])
            }
          >
            + Add slot
          </button>
        </div>

        {draft.length === 0 ? (
          <p className="mt-4 text-sm text-faint">
            No hours set — customers can still send requests, but your calendar
            shows as flexible.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {draft.map((slot, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <select
                  className="input w-36"
                  value={slot.dayOfWeek}
                  onChange={(e) =>
                    updateSlot(i, { dayOfWeek: Number(e.target.value) })
                  }
                >
                  {dayNames.map((d, di) => (
                    <option key={d} value={di}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  className="input w-32"
                  value={slot.startTime}
                  onChange={(e) => updateSlot(i, { startTime: e.target.value })}
                />
                <span className="text-faint">to</span>
                <input
                  type="time"
                  className="input w-32"
                  value={slot.endTime}
                  onChange={(e) => updateSlot(i, { endTime: e.target.value })}
                />
                <button
                  type="button"
                  className="text-xs text-danger"
                  onClick={() => setDraft((d) => d.filter((_, di) => di !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={saveWeekly}
          disabled={busy}
          className="btn-gold mt-5"
        >
          {busy ? "Saving…" : "Save weekly schedule"}
        </button>
      </section>

      {/* Date exceptions */}
      <section className="card p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Blocked dates
        </h2>
        <form onSubmit={handleBlockDate} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="e-date">
              Date
            </label>
            <input
              id="e-date"
              name="date"
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </div>
          <div className="min-w-40 flex-1">
            <label className="label" htmlFor="e-note">
              Note (optional)
            </label>
            <input id="e-note" name="note" placeholder="Holiday, personal…" className="input" />
          </div>
          <button type="submit" className="btn-outline">
            Block date
          </button>
        </form>

        {exceptions.length > 0 && (
          <ul className="mt-4 space-y-2">
            {exceptions.map((ex) => (
              <li
                key={ex.id}
                className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm"
              >
                <span className="text-ink">
                  {ex.date}
                  {ex.note && <span className="ml-2 text-xs text-faint">{ex.note}</span>}
                </span>
                <button
                  type="button"
                  className="text-xs text-danger"
                  onClick={async () => {
                    const res = await removeAvailabilityException(ex.id);
                    if (res.ok) router.refresh();
                    else toast.error(res.error);
                  }}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
