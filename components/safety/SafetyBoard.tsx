"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  acknowledgeSafetyAlert,
  pingWorker,
  resolveSafetyAlert,
  revealMeetingPin,
} from "@/actions/safety-desk";
import { safetyAlertLabel } from "@/lib/constants";
import type { SafetyBoardEntry, SafetyHealth } from "@/types";

const healthStyles: Record<SafetyHealth, { border: string; dot: string; label: string }> = {
  alarm: { border: "border-danger", dot: "bg-danger", label: "ALERT" },
  unresponsive: { border: "border-danger/70", dot: "bg-danger", label: "NO SIGNAL" },
  overdue: { border: "border-warn/70", dot: "bg-warn", label: "OVERDUE" },
  ok: { border: "border-hairline", dot: "bg-success", label: "OK" },
  idle: { border: "border-hairline", dot: "bg-hairline", label: "IDLE" },
};

// The monitor's working surface. Colour-coded worst-first, with live countdowns
// so "how long has this been wrong?" is answerable at a glance rather than by
// arithmetic on timestamps.
export default function SafetyBoard({
  initial,
  canSeePins,
}: {
  initial: SafetyBoardEntry[];
  canSeePins: boolean;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [connected, setConnected] = useState(false);

  // Adjust during render, not in an effect: the board must never paint a
  // stale picture of who is in trouble, even for one frame.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setEntries(initial);
  }

  // Local clock so every countdown ticks without hammering the server.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live updates: any safety change anywhere re-reads the board.
  useEffect(() => {
    const source = new EventSource("/api/safety/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = () => router.refresh();
    return () => source.close();
  }, [router]);

  if (entries.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">No monitored visits right now.</p>
        <p className="mt-1 text-xs text-faint">
          Sessions appear here the moment a worker sets out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-hairline"}`} />
        <span className={connected ? "text-success" : "text-faint"}>
          {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      {entries.map((entry) => (
        <BoardCard
          key={entry.sessionId}
          entry={entry}
          now={now}
          canSeePins={canSeePins}
          onChanged={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function BoardCard({
  entry,
  now,
  canSeePins,
  onChanged,
}: {
  entry: SafetyBoardEntry;
  now: number;
  canSeePins: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const style = healthStyles[entry.health];

  const heartbeatAge = entry.lastHeartbeatAt
    ? Math.round((now - new Date(entry.lastHeartbeatAt).getTime()) / 1000)
    : null;
  const checkinIn = entry.nextCheckInAt
    ? Math.round((new Date(entry.nextCheckInAt).getTime() - now) / 1000)
    : null;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast.success(msg);
      onChanged();
    } else {
      toast.error(res.error ?? "Something went wrong");
    }
  }

  return (
    <div className={`card space-y-3 border p-5 ${style.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot} ${
                entry.health === "alarm" ? "animate-pulse" : ""
              }`}
            />
            <span className="font-medium text-ink">{entry.workerName}</span>
            <Link href={`/bookings/${entry.bookingId}`} className="text-xs text-gold">
              {entry.bookingCode}
            </Link>
            <span className="text-xs uppercase tracking-wider text-faint">
              {entry.state.replace("_", " ")}
            </span>
          </p>
          <p className="mt-1 truncate text-xs text-muted">{entry.address}</p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
            entry.health === "ok"
              ? "text-success"
              : entry.health === "overdue"
                ? "text-warn"
                : "text-danger"
          }`}
        >
          {style.label}
        </span>
      </div>

      {/* The three numbers a monitor actually needs, always in the same place */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <Stat
          label="Last signal"
          value={heartbeatAge === null ? "—" : formatAge(heartbeatAge)}
          tone={heartbeatAge !== null && heartbeatAge > 180 ? "bad" : "normal"}
        />
        <Stat
          label="Next check-in"
          value={checkinIn === null ? "—" : checkinIn <= 0 ? `${formatAge(-checkinIn)} late` : formatAge(checkinIn)}
          tone={checkinIn !== null && checkinIn <= 0 ? "bad" : "normal"}
        />
        <Stat
          label="Battery"
          value={entry.batteryPct === null ? "—" : `${entry.batteryPct}%`}
          tone={entry.batteryPct !== null && entry.batteryPct <= 15 ? "bad" : "normal"}
        />
      </div>

      {entry.openAlerts.length > 0 && (
        <div className="space-y-2">
          {entry.openAlerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-xl border border-danger/50 bg-danger/5 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-danger">
                    {safetyAlertLabel(alert.kind)}
                    {alert.covert && (
                      <span className="ml-2 rounded bg-danger/20 px-1.5 py-0.5 text-xs">
                        COVERT — do not call
                      </span>
                    )}
                  </p>
                  {alert.message && (
                    <p className="mt-1 text-xs text-muted">{alert.message}</p>
                  )}
                  <p className="mt-1 text-xs text-faint">
                    Raised {formatAge(Math.round((now - new Date(alert.createdAt).getTime()) / 1000))} ago
                    {" · "}
                    {alert.acknowledgedAt
                      ? `claimed by ${alert.acknowledgedBy ?? "a responder"}`
                      : `stage ${alert.stage + 1} — UNCLAIMED`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!alert.acknowledgedAt && (
                    <button
                      type="button"
                      className="btn-gold text-xs"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => acknowledgeSafetyAlert({ alertId: alert.id }),
                          "Claimed — it's yours"
                        )
                      }
                    >
                      Claim
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-outline text-xs text-success"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => resolveSafetyAlert({ alertId: alert.id }),
                        "Alert resolved"
                      )
                    }
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
        <button
          type="button"
          className="btn-outline text-xs"
          disabled={busy}
          onClick={() =>
            run(() => pingWorker({ bookingId: entry.bookingId }), "Check-in requested")
          }
        >
          Ping worker
        </button>
        <Link href={`/bookings/${entry.bookingId}`} className="btn-outline text-xs">
          Open room
        </Link>
        {entry.lastPing && (
          <a
            className="btn-outline text-xs"
            href={`https://www.google.com/maps?q=${entry.lastPing.lat},${entry.lastPing.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Last position
          </a>
        )}
        {/* Revealing a PIN is a logged act, not a glance. */}
        {!canSeePins &&
          (pin ? (
            <span className="text-xs tracking-[0.3em] text-ink">{pin}</span>
          ) : (
            <button
              type="button"
              className="btn-outline text-xs"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await revealMeetingPin({ bookingId: entry.bookingId });
                setBusy(false);
                if (res.ok) setPin(res.data.pin);
                else toast.error(res.error);
              }}
            >
              Reveal PIN
            </button>
          ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "normal" | "bad";
}) {
  return (
    <div className="rounded-lg border border-hairline p-2">
      <p className="text-xs uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-0.5 text-sm ${tone === "bad" ? "text-danger" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
