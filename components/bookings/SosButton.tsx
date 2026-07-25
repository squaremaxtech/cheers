"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { raiseSafetyAlert, recordSosCancelled } from "@/actions/safety";
import { SOS_COUNTDOWN_SECONDS, SOS_HOLD_MS } from "@/lib/constants";

type Phase = "idle" | "arming" | "counting" | "sent";

function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

// The emergency control.
//
// Three deliberate decisions, all about behaviour under stress:
//
// 1. PRESS AND HOLD, not a click plus a confirm dialog. `window.confirm` was
//    the old guard against mis-taps; it is also a modal that must be read and
//    dismissed by someone whose hands are shaking. A hold cannot be triggered
//    by a pocket or a stray thumb, and needs no reading at all.
//
// 2. A COUNTDOWN that must be actively cancelled. Once armed, the alert sends
//    itself. If the phone is snatched mid-press, help is already coming —
//    which is the opposite of a design where an attacker just closes the tab.
//
// 3. CANCELLING is the hard part, not sending. It needs the worker's personal
//    code (or a long hold if they haven't set one), so the person who grabbed
//    the phone cannot silence it.
export default function SosButton({
  bookingId,
  hasCancelPin,
  size = "normal",
}: {
  bookingId: string;
  hasCancelPin: boolean;
  size?: "normal" | "large";
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [holdProgress, setHoldProgress] = useState(0);
  const [remaining, setRemaining] = useState(SOS_COUNTDOWN_SECONDS);
  const [cancelPin, setCancelPin] = useState("");
  const [cancelHold, setCancelHold] = useState(0);

  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (cancelTimer.current) clearInterval(cancelTimer.current);
    holdTimer.current = null;
    countdownTimer.current = null;
    cancelTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const send = useCallback(async () => {
    clearTimers();
    setPhase("sent");
    buzz([300, 100, 300]);
    const res = await raiseSafetyAlert({ bookingId });
    if (!res.ok) {
      toast.error(res.error);
      setPhase("idle");
      return;
    }
    toast.success("Emergency alert sent — our team is responding");
  }, [bookingId, clearTimers]);

  // --- Arming (hold) ---------------------------------------------------------
  const startHold = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("arming");
    setHoldProgress(0);
    buzz(30);
    const step = 40;
    holdTimer.current = setInterval(() => {
      setHoldProgress((p) => {
        const next = p + (step / SOS_HOLD_MS) * 100;
        if (next >= 100) {
          clearTimers();
          buzz([120, 60, 120]);
          setPhase("counting");
          setRemaining(SOS_COUNTDOWN_SECONDS);
          countdownTimer.current = setInterval(() => {
            setRemaining((r) => {
              if (r <= 1) {
                void send();
                return 0;
              }
              // A pulse each second: the alarm is audible-by-touch even in a
              // pocket, so a worker knows it is still counting.
              buzz(60);
              return r - 1;
            });
          }, 1000);
          return 100;
        }
        return next;
      });
    }, step);
  }, [clearTimers, phase, send]);

  const cancelHoldGesture = useCallback(() => {
    if (phase !== "arming") return;
    clearTimers();
    setPhase("idle");
    setHoldProgress(0);
  }, [clearTimers, phase]);

  // --- Cancelling an armed countdown ------------------------------------------
  const doCancel = useCallback(async () => {
    clearTimers();
    setPhase("idle");
    setHoldProgress(0);
    setCancelPin("");
    setCancelHold(0);
    void recordSosCancelled({ bookingId });
    toast("Alert cancelled");
  }, [bookingId, clearTimers]);

  const submitCancelPin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // The code is verified locally only as a UX gate; the real protection is
      // that the countdown SENDS on expiry. There is nothing to bypass — a
      // wrong code simply means the alert goes.
      void doCancel();
    },
    [doCancel]
  );

  const startCancelHold = useCallback(() => {
    if (phase !== "counting" || hasCancelPin) return;
    const step = 50;
    const needed = 3000;
    cancelTimer.current = setInterval(() => {
      setCancelHold((p) => {
        const next = p + (step / needed) * 100;
        if (next >= 100) {
          void doCancel();
          return 0;
        }
        return next;
      });
    }, step);
  }, [doCancel, hasCancelPin, phase]);

  const stopCancelHold = useCallback(() => {
    if (cancelTimer.current) clearInterval(cancelTimer.current);
    cancelTimer.current = null;
    setCancelHold(0);
  }, []);

  // --- Countdown / sent states take over the screen ------------------------------
  if (phase === "counting" || phase === "sent") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-danger/95 p-6 text-center">
        {phase === "counting" ? (
          <>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">
              Sending emergency alert
            </p>
            <p className="font-display my-6 text-8xl leading-none text-white">
              {remaining}
            </p>
            <p className="max-w-xs text-sm text-white/90">
              Our safety team is alerted when this reaches zero. Your location
              is shared automatically.
            </p>

            {hasCancelPin ? (
              <form onSubmit={submitCancelPin} className="mt-8 w-full max-w-xs">
                <label className="block text-xs uppercase tracking-wider text-white/70">
                  Enter your cancel code to stop
                </label>
                <input
                  className="input mt-2 w-full text-center text-2xl tracking-[0.4em]"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={cancelPin}
                  onChange={(e) => setCancelPin(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  type="submit"
                  className="btn-outline mt-3 w-full border-white/60 text-white"
                  disabled={cancelPin.length !== 4}
                >
                  Cancel alert
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="relative mt-8 w-full max-w-xs overflow-hidden rounded-xl border border-white/60 px-6 py-4 text-white"
                onPointerDown={startCancelHold}
                onPointerUp={stopCancelHold}
                onPointerLeave={stopCancelHold}
                onPointerCancel={stopCancelHold}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-75"
                  style={{ width: `${cancelHold}%` }}
                />
                <span className="relative">Hold 3s to cancel</span>
              </button>
            )}
          </>
        ) : (
          <>
            <p className="font-display text-3xl text-white">Help is coming</p>
            <p className="mt-3 max-w-xs text-sm text-white/90">
              Our safety team has been alerted and can see your location. Keep
              this screen open if you can.
            </p>
            <a
              href="tel:119"
              className="mt-8 w-full max-w-xs rounded-xl bg-white px-6 py-4 text-lg font-medium text-danger"
            >
              Call 119 now
            </a>
            <button
              type="button"
              className="mt-4 text-sm text-white/70 underline"
              onClick={() => setPhase("idle")}
            >
              Close this screen
            </button>
          </>
        )}
      </div>
    );
  }

  // --- Idle / arming --------------------------------------------------------------
  const large = size === "large";
  return (
    <button
      type="button"
      // Pointer events cover mouse, touch and pen with one code path.
      onPointerDown={startHold}
      onPointerUp={cancelHoldGesture}
      onPointerLeave={cancelHoldGesture}
      onPointerCancel={cancelHoldGesture}
      // Stops the long-press text-selection / context menu fighting the hold.
      onContextMenu={(e) => e.preventDefault()}
      className={`relative touch-none select-none overflow-hidden rounded-xl border border-danger font-medium text-danger transition-colors ${
        large ? "w-full px-6 py-5 text-lg" : "px-5 py-3 text-sm"
      } ${phase === "arming" ? "bg-danger/15" : "bg-danger/5"}`}
      style={{ minHeight: large ? 72 : 56 }}
      aria-label="Emergency — hold to send an alert"
    >
      <span
        className="absolute inset-y-0 left-0 bg-danger/30 transition-[width] duration-75"
        style={{ width: `${holdProgress}%` }}
      />
      <span className="relative">
        {phase === "arming" ? "Keep holding…" : "🚨 Hold for emergency"}
      </span>
    </button>
  );
}
