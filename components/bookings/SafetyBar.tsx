"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SosButton from "@/components/bookings/SosButton";
import {
  endSafetySession,
  respondToCheckin,
  snoozeCheckin,
} from "@/actions/safety";
import {
  CHECKIN_SNOOZE_MINUTES,
  checkinIntervalLabel,
  HEARTBEAT_SECONDS,
} from "@/lib/constants";
import type { SafetyClientState } from "@/types";

// THE SAFETY BAR — the worker's single, permanent safety surface.
//
// UX rules this encodes, all of them about a person under stress:
//
//  · ONE PLACE, ALWAYS. It is fixed to the bottom of the viewport and never
//    scrolls away, so the check-in and the SOS live in the same spot every
//    time. Muscle memory beats searching when you are frightened.
//  · THUMB ZONE. Bottom-centre is the easiest reach one-handed; safety
//    controls sit there rather than in a header nobody can reach holding a bag.
//  · BIG TARGETS. 48px minimum everywhere, 64px+ for check-in and SOS.
//  · ONE DOMINANT ACTION PER STATE. When a check-in is due, "I'm OK" is the
//    only prominent thing on screen. No menus, no choices to weigh.
//  · STATUS IS ALWAYS VISIBLE. Monitoring state and the next deadline are
//    shown continuously, so "am I being watched?" is never a question.
//  · REDUNDANT ENCODING. Colour + icon + position + vibration, because stress
//    narrows attention and colour alone is not enough.
export default function SafetyBar({
  bookingId,
  initial,
  hasCancelPin,
  isWorker,
  monitored,
}: {
  bookingId: string;
  initial: SafetyClientState;
  hasCancelPin: boolean;
  isWorker: boolean;
  // bookings.monitored snapshot. When false the booking runs NO monitored
  // session (no check-ins, heartbeats or travel deadlines) — the bar slims
  // down to the always-available emergency controls: SOS only. Location
  // sharing lives in BookingLive and stays available regardless.
  monitored: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<SafetyClientState>(initial);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpNote, setHelpNote] = useState("");
  const [queued, setQueued] = useState(false);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Re-sync from the server during render (React's documented pattern for
  // derived state) rather than in an effect, which would render the stale
  // value once first — and a stale safety state is exactly the wrong thing to
  // show for even a frame.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setState(initial);
  }

  // --- Ticking clock so countdowns move without a server round-trip ----------
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Connectivity ----------------------------------------------------------
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // --- Wake lock: the safety screen must not die with the screen -------------
  useEffect(() => {
    if (!isWorker || !monitored) return;
    if (!state.sessionState || state.sessionState === "ended") return;
    let released = false;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Denied or unsupported — heartbeats still carry the session.
      }
    };
    void request();
    // A wake lock is dropped whenever the tab is hidden; re-take it on return.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [isWorker, monitored, state.sessionState]);

  // --- Heartbeat: the passive alarm ------------------------------------------
  const sendHeartbeat = useCallback(async () => {
    if (!isWorker) return;
    let battery: number | undefined;
    try {
      const nav = navigator as Navigator & {
        getBattery?: () => Promise<{ level: number }>;
      };
      if (nav.getBattery) {
        const b = await nav.getBattery();
        battery = Math.round(b.level * 100);
      }
    } catch {
      // battery API unavailable — not required
    }

    const post = (coords?: GeolocationCoordinates) =>
      fetch("/api/safety/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          bookingId,
          batteryPct: battery,
          online: navigator.onLine,
          ...(coords
            ? {
                lat: coords.latitude,
                lng: coords.longitude,
                accuracyM: coords.accuracy,
                speedMps: coords.speed ?? undefined,
                headingDeg: coords.heading ?? undefined,
              }
            : {}),
        }),
      }).catch(() => undefined);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void post(pos.coords),
        () => void post(),
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
      );
    } else {
      void post();
    }
  }, [bookingId, isWorker]);

  useEffect(() => {
    if (!isWorker || !monitored) return;
    if (!state.sessionState || state.sessionState === "ended") return;
    void sendHeartbeat();
    const timer = setInterval(() => void sendHeartbeat(), HEARTBEAT_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [isWorker, monitored, sendHeartbeat, state.sessionState]);

  // --- Answering a check-in ---------------------------------------------------
  const answer = useCallback(
    async (status: "ok" | "help", covert = false) => {
      setBusy(true);
      // Optimistic: the worker sees their tap land instantly. If the network
      // is down we say so honestly and retry rather than pretending.
      setState((s) => ({ ...s, checkinDue: false, checkinOverdue: false }));
      const res = await respondToCheckin({
        bookingId,
        status,
        method: "in_app",
        covert,
        note: covert || status === "help" ? helpNote || undefined : undefined,
      });
      setBusy(false);
      if (res.ok) {
        setQueued(false);
        setShowHelp(false);
        setHelpNote("");
        // A covert help request must look EXACTLY like a normal check-in.
        toast.success(
          status === "ok" || covert
            ? "Check-in recorded — stay safe"
            : "Help request sent — our team has been alerted"
        );
        router.refresh();
      } else if (!navigator.onLine) {
        setQueued(true);
        toast("Saved — will send the moment you're back online");
      } else {
        setState((s) => ({ ...s, checkinDue: true }));
        toast.error(res.error);
      }
    },
    [bookingId, helpNote, router]
  );

  // Offline queue: retry the moment connectivity returns. Deferred by a tick
  // so the retry is a reaction to the browser coming back online, not a
  // synchronous cascade inside the effect that observed it.
  useEffect(() => {
    if (!queued || !online) return;
    const timer = setTimeout(() => void answer("ok"), 0);
    return () => clearTimeout(timer);
  }, [answer, online, queued]);

  // --- Snooze: "I'm on stage, ask me later" -----------------------------------
  // Deliberately a plain text control, never a button: it must not compete
  // with "I'm OK" and must never be mistaken for the SOS. It moves the next
  // check-in and nothing else — get-home-safe, the overrun and arrival
  // deadlines, the heartbeat and the SOS all keep running.
  const snooze = useCallback(async () => {
    setBusy(true);
    const res = await snoozeCheckin({ bookingId });
    setBusy(false);
    if (res.ok) {
      setState((s) => ({
        ...s,
        checkinDue: false,
        checkinOverdue: false,
        nextCheckInAt: res.data.nextCheckInAt,
        snoozesRemaining: res.data.remaining,
      }));
      toast.success(
        res.data.remaining > 0
          ? `Snoozed — next check-in in ${formatHours(CHECKIN_SNOOZE_MINUTES)}. ${res.data.remaining} left.`
          : `Snoozed — next check-in in ${formatHours(CHECKIN_SNOOZE_MINUTES)}. That was your last one.`
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }, [bookingId, router]);

  const finish = useCallback(
    async (reason: "left_visit" | "home_safe") => {
      setBusy(true);
      const res = await endSafetySession({ bookingId, reason });
      setBusy(false);
      if (res.ok) {
        toast.success(
          reason === "left_visit"
            ? "Noted — we'll check you got home safely"
            : "Glad you're home. Monitoring ended."
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    },
    [bookingId, router]
  );

  if (!isWorker || !monitored) {
    // Customers — and workers on an UNMONITORED booking — get the emergency
    // control only: no check-ins, no session state, no travel CTAs. The slim
    // bar stays minimal so it never competes for attention. (SOS is never
    // gated: unmonitored means no scheduled machinery, not no help.)
    return (
      <div className="safety-bar">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-faint">
            In danger? Call <a href="tel:119" className="text-brand underline">119</a> first.
          </p>
          <SosButton
            bookingId={bookingId}
            hasCancelPin={isWorker ? hasCancelPin : false}
          />
        </div>
      </div>
    );
  }

  const active = state.sessionState && state.sessionState !== "ended";
  if (!active) return null;

  const overdue = state.checkinOverdue;
  const due = state.checkinDue || overdue;
  const nextCheckIn = state.nextCheckInAt ? new Date(state.nextCheckInAt) : null;
  const secondsToCheckIn = nextCheckIn
    ? Math.max(0, Math.round((nextCheckIn.getTime() - now) / 1000))
    : null;
  // The cadence chosen for this gig, already resolved by the server. Shown
  // continuously so a professional never has to wonder how often they are
  // about to be interrupted — and so "no prompt for four hours" reads as the
  // arrangement rather than as the system having forgotten them.
  const periodic = state.checkinIntervalMinutes > 0;
  const cadenceLabel = periodic
    ? checkinIntervalLabel(state.checkinIntervalMinutes)
    : "Start and end only";
  // Nothing to push out when there is no periodic check-in, and nothing left
  // to push once the cap is spent.
  const canSnooze = periodic && state.snoozesRemaining > 0;

  // --- Overdue takeover ---------------------------------------------------------
  // Past the grace point the bar is not enough: a full-screen prompt with one
  // giant target, plus an explicit statement of what happens if they do
  // nothing. Nobody should have to guess whether help is already coming.
  if (overdue) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-md space-y-4 p-5 pb-8">
          <div className="rounded-2xl border border-warn bg-surface p-6 text-center shadow-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-warn">
              Check-in overdue
            </p>
            <p className="mt-2 text-sm text-muted">
              {state.secondsUntilEscalation !== null &&
              state.secondsUntilEscalation > 0
                ? `Our safety team is alerted in ${formatCountdown(state.secondsUntilEscalation)} if we don't hear from you.`
                : "Our safety team has been alerted and is working on it."}
            </p>
            <button
              type="button"
              className="btn-primary mt-5 w-full py-5 text-lg"
              style={{ minHeight: 72 }}
              disabled={busy}
              onClick={() => void answer("ok")}
            >
              ✓ I&apos;m OK
            </button>
            <button
              type="button"
              className="btn-outline mt-3 w-full py-4 text-warn"
              style={{ minHeight: 56 }}
              disabled={busy}
              onClick={() => setShowHelp((v) => !v)}
            >
              I need help
            </button>
            {canSnooze && (
              <button
                type="button"
                className="mt-3 text-xs text-muted underline"
                disabled={busy}
                onClick={() => void snooze()}
              >
                Can&apos;t answer right now — snooze{" "}
                {formatHours(CHECKIN_SNOOZE_MINUTES)} ({state.snoozesRemaining}{" "}
                left)
              </button>
            )}
            {showHelp && <HelpPanel note={helpNote} onNote={setHelpNote} onSend={answer} busy={busy} />}
          </div>
          <SosButton bookingId={bookingId} hasCancelPin={hasCancelPin} size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="safety-bar">
      <div className="mx-auto w-full max-w-3xl px-4 py-2.5">
        {/* Status strip — always present, so "am I monitored?" is never a question */}
        <div className="flex items-center justify-between gap-3 pb-2 text-xs">
          <span className="flex items-center gap-2 text-muted">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                online ? "animate-pulse bg-success" : "bg-warn"
              }`}
            />
            {online ? "Monitored" : "Offline — will resend"}
            {state.monitorName && (
              <span className="text-faint">· {state.monitorName} watching</span>
            )}
          </span>
          {secondsToCheckIn !== null && !due ? (
            <span className="shrink-0 text-faint">
              Next check-in {formatCountdown(secondsToCheckIn)}
            </span>
          ) : (
            !periodic && (
              <span className="shrink-0 text-faint">{cadenceLabel}</span>
            )
          )}
        </div>
        {/* The arrangement, stated plainly. A performer who set "start and end
            only" must be able to see that the quiet is deliberate — and
            everyone else must be able to see how often they'll be asked. */}
        {periodic && (
          <p className="pb-2 text-xs text-faint">Check-ins: {cadenceLabel}</p>
        )}

        {/* Actions — the check-in dominates when due, recedes when not */}
        <div className="flex items-stretch gap-2">
          {due ? (
            <button
              type="button"
              className="btn-primary flex-1 text-lg"
              style={{ minHeight: 64 }}
              disabled={busy}
              onClick={() => void answer("ok")}
            >
              ✓ I&apos;m OK
            </button>
          ) : (
            <button
              type="button"
              className="btn-outline flex-1"
              style={{ minHeight: 48 }}
              disabled={busy}
              onClick={() => void answer("ok")}
            >
              ✓ Check in now
            </button>
          )}
          <SosButton bookingId={bookingId} hasCancelPin={hasCancelPin} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            className="text-xs text-warn underline"
            onClick={() => setShowHelp((v) => !v)}
          >
            I need help
          </button>
          {canSnooze && (
            <button
              type="button"
              className="text-xs text-muted underline"
              disabled={busy}
              onClick={() => void snooze()}
            >
              Snooze {formatHours(CHECKIN_SNOOZE_MINUTES)} (
              {state.snoozesRemaining} left)
            </button>
          )}
          {state.sessionState === "heading_home" ? (
            <button
              type="button"
              className="text-xs text-success underline"
              disabled={busy}
              onClick={() => void finish("home_safe")}
            >
              I got home safely
            </button>
          ) : (
            <button
              type="button"
              className="text-xs text-muted underline"
              disabled={busy}
              onClick={() => void finish("left_visit")}
            >
              I&apos;ve left the visit
            </button>
          )}
          <a href="tel:119" className="text-xs text-faint">
            Call 119
          </a>
        </div>

        {showHelp && <HelpPanel note={helpNote} onNote={setHelpNote} onSend={answer} busy={busy} />}
      </div>
    </div>
  );
}

// The help panel carries the QUIET option — a report that shows an ordinary
// "check-in recorded" toast on screen while the desk is paged. A worker being
// watched can raise the alarm with the phone in plain sight.
function HelpPanel({
  note,
  onNote,
  onSend,
  busy,
}: {
  note: string;
  onNote: (v: string) => void;
  onSend: (status: "ok" | "help", covert?: boolean) => Promise<void>;
  busy: boolean;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-hairline p-3">
      <input
        className="input w-full text-sm"
        placeholder="What's happening? (optional)"
        value={note}
        onChange={(e) => onNote(e.target.value)}
        maxLength={300}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-danger flex-1"
          style={{ minHeight: 48 }}
          disabled={busy}
          onClick={() => void onSend("help")}
        >
          Send help request
        </button>
        <button
          type="button"
          className="btn-outline flex-1"
          style={{ minHeight: 48 }}
          disabled={busy}
          onClick={() => void onSend("help", true)}
        >
          Report quietly
        </button>
      </div>
      <p className="text-xs text-faint">
        &ldquo;Report quietly&rdquo; alerts our team but shows a normal check-in
        on this screen.
      </p>
    </div>
  );
}

// "2 hours" / "90 minutes" — the snooze length in words, since the control
// says what it does rather than making anyone divide by sixty.
function formatHours(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
