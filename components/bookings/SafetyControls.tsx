"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  raiseSafetyAlert,
  recordWellnessCheck,
  startServiceWithPin,
} from "@/actions/safety";
import type { BookingStatus, BookingViewerRole } from "@/types";

// Interactive safety controls for the booking room. What renders depends on
// who is looking: workers get PIN start + wellness check-ins + SOS, customers
// get SOS. Staff act on alerts via AlertActions instead.
export default function SafetyControls({
  bookingId,
  viewerRole,
  status,
}: {
  bookingId: string;
  viewerRole: BookingViewerRole;
  status: BookingStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [helpNote, setHelpNote] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const live = status === "confirmed" || status === "in_progress";
  if (!live) return null;

  async function handleStart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await startServiceWithPin({ bookingId, pin });
    setBusy(false);
    if (res.ok) {
      toast.success("PIN verified — session started");
      setPin("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleWellness(checkStatus: "ok" | "help") {
    setBusy(true);
    const res = await recordWellnessCheck({
      bookingId,
      status: checkStatus,
      note: checkStatus === "help" && helpNote ? helpNote : undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(
        checkStatus === "ok"
          ? "Check-in recorded — stay safe"
          : "Help request sent — our team has been alerted"
      );
      setShowHelp(false);
      setHelpNote("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleSos() {
    if (
      !window.confirm(
        "Send an emergency alert? Our safety team is notified immediately."
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await raiseSafetyAlert({ bookingId });
    setBusy(false);
    if (res.ok) {
      toast.success("Emergency alert sent — help is on the way");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {viewerRole === "worker" && status === "confirmed" && (
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
          <button type="submit" className="btn-gold" disabled={busy || pin.length !== 4}>
            Verify PIN & start
          </button>
          <p className="w-full text-xs text-faint">
            Ask the customer for their booking PIN when you arrive — verifying
            it starts the session and the wellness-check clock.
          </p>
        </form>
      )}

      {viewerRole === "worker" && status === "in_progress" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-gold"
              disabled={busy}
              onClick={() => handleWellness("ok")}
            >
              ✓ I&apos;m OK
            </button>
            <button
              type="button"
              className="btn-outline text-warn"
              disabled={busy}
              onClick={() => setShowHelp((v) => !v)}
            >
              I need help
            </button>
          </div>
          {showHelp && (
            <div className="flex flex-wrap items-end gap-2">
              <input
                className="input flex-1"
                placeholder="What's happening? (optional)"
                value={helpNote}
                onChange={(e) => setHelpNote(e.target.value)}
                maxLength={300}
              />
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                onClick={() => handleWellness("help")}
              >
                Send help request
              </button>
            </div>
          )}
        </div>
      )}

      {(viewerRole === "worker" || viewerRole === "customer") && (
        <div className="hairline-top flex flex-wrap items-center gap-3 pt-4">
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={handleSos}
          >
            🚨 Emergency — alert Cheers
          </button>
          <p className="text-xs text-faint">
            Alerts our 24/7 safety team with this booking&apos;s location.
            For immediate danger always call 119 first.
          </p>
        </div>
      )}
    </div>
  );
}
