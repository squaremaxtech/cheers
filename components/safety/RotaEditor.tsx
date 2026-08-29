"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createMonitorShift, deleteMonitorShift } from "@/actions/safety-desk";
import Select from "@/components/ui/Select";

type Shift = { id: string; who: string; startsAt: string; endsAt: string };

export default function RotaEditor({
  shifts,
  candidates,
  canEdit,
}: {
  shifts: Shift[];
  candidates: { id: string; label: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(candidates[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  // Ticking clock so the "on duty" marker becomes correct as a shift starts,
  // without a page reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createMonitorShift({
      userId,
      // datetime-local gives wall-clock with no zone; the browser's own zone
      // is the right interpretation for a person's shift.
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Shift added");
      setStartsAt("");
      setEndsAt("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await deleteMonitorShift({ shiftId: id });
    setBusy(false);
    if (res.ok) {
      toast.success("Shift removed");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <form onSubmit={add} className="card space-y-3 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Add a shift
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="r-who">
                Who
              </label>
              <Select
                id="r-who"
                value={userId}
                onChange={(v) => setUserId(v)}
                required
                options={candidates.map((c) => ({
                  value: c.id,
                  label: c.label,
                }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="r-start">
                From
              </label>
              <input
                id="r-start"
                type="datetime-local"
                className="input"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="r-end">
                To
              </label>
              <input
                id="r-end"
                type="datetime-local"
                className="input"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={busy || !userId}>
            Add shift
          </button>
        </form>
      )}

      <div className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Upcoming shifts
        </h2>
        {shifts.length === 0 ? (
          <p className="mt-4 text-sm text-warn">
            Nobody is rostered. Escalations will page the entire desk instead of
            a named responder.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {shifts.map((s) => {
              const live =
                new Date(s.startsAt).getTime() <= now &&
                new Date(s.endsAt).getTime() > now;
              return (
                <li
                  key={s.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                    live ? "border-success/50 bg-success/5" : "border-hairline"
                  }`}
                >
                  <span className="text-ink">
                    {s.who}
                    {live && (
                      <span className="ml-2 text-xs uppercase tracking-wider text-success">
                        on duty
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(s.startsAt).toLocaleString()} →{" "}
                    {new Date(s.endsAt).toLocaleString()}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      disabled={busy}
                      onClick={() => void remove(s.id)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
