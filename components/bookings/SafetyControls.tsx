"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { startServiceWithPin, startTravelling } from "@/actions/safety";
import type { BookingStatus, BookingViewerRole } from "@/types";

// Arrival controls for the booking room: declaring travel, then verifying the
// customer's PIN at the door. Ongoing check-ins and the emergency control live
// in the fixed SafetyBar instead — those must never scroll away.
export default function SafetyControls({
  bookingId,
  viewerRole,
  status,
  sessionStarted,
  duressPin,
}: {
  bookingId: string;
  viewerRole: BookingViewerRole;
  status: BookingStatus;
  sessionStarted: boolean;
  // Present only for the assigned worker — see the booking page.
  duressPin: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [eta, setEta] = useState(30);
  const [showDuress, setShowDuress] = useState(false);

  const live = status === "confirmed" || status === "in_progress";
  if (!live || viewerRole !== "worker") return null;

  async function handleTravel() {
    setBusy(true);
    const res = await startTravelling({ bookingId, etaMinutes: eta });
    setBusy(false);
    if (res.ok) {
      toast.success("Monitoring started — we're watching your journey");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleStart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await startServiceWithPin({ bookingId, pin });
    setBusy(false);
    // The response is identical for a normal PIN and a duress PIN — nothing
    // here may hint that a covert alert was raised.
    if (res.ok) {
      toast.success("PIN verified — session started");
      setPin("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {status === "confirmed" && !sessionStarted && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="s-eta">
              I&apos;ll arrive in
            </label>
            <select
              id="s-eta"
              className="input w-32"
              value={eta}
              onChange={(e) => setEta(Number(e.target.value))}
            >
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn-gold"
            style={{ minHeight: 48 }}
            disabled={busy}
            onClick={handleTravel}
          >
            I&apos;m on my way
          </button>
          <p className="w-full text-xs text-faint">
            Starts safety monitoring for your journey. If you don&apos;t confirm
            arrival, our team follows up automatically.
          </p>
        </div>
      )}

      {status === "confirmed" && (
        <form onSubmit={handleStart} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="s-pin">
              Customer&apos;s PIN
            </label>
            <input
              id="s-pin"
              className="input w-32 tracking-[0.3em]"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <button
            type="submit"
            className="btn-gold"
            style={{ minHeight: 48 }}
            disabled={busy || pin.length !== 4}
          >
            Verify PIN &amp; start
          </button>
          <p className="w-full text-xs text-faint">
            Ask the customer for their booking PIN when you arrive — verifying
            it starts the session and the check-in clock.
          </p>
        </form>
      )}

      {/* The duress PIN. Shown only to the assigned worker, kept behind a tap
          so it is never sitting on screen where someone could read it over
          their shoulder. */}
      {duressPin && status === "confirmed" && (
        <div className="rounded-xl border border-hairline p-3">
          <button
            type="button"
            className="text-xs text-muted underline"
            onClick={() => setShowDuress((v) => !v)}
          >
            {showDuress ? "Hide" : "Show"} my emergency PIN
          </button>
          {showDuress && (
            <div className="mt-2">
              <p className="font-display text-2xl tracking-[0.4em] text-warn">
                {duressPin}
              </p>
              <p className="mt-2 text-xs text-muted">
                If you&apos;re being forced or watched, enter{" "}
                <strong className="text-ink">this</strong> PIN instead of the
                customer&apos;s. The screen will behave exactly as normal — the
                session starts, the same message appears — but our safety team
                is alerted immediately and will not call your phone.
              </p>
              <p className="mt-1 text-xs text-faint">
                Only you can see this. The customer and our staff never do.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
