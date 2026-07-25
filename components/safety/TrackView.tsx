"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SafetyHealth, SafetySessionState } from "@/types";

// What a trusted contact sees. Written for someone who is not a user of the
// platform, may be worried, and needs one clear answer: is my person OK?
export default function TrackView({
  stageName,
  state,
  health,
  lastHeartbeatAt,
  lastPing,
  expectedEndAt,
}: {
  stageName: string;
  state: SafetySessionState;
  health: SafetyHealth;
  lastHeartbeatAt: string | null;
  lastPing: { lat: string; lng: string; at: string } | null;
  expectedEndAt: string | null;
}) {
  const router = useRouter();

  // No SSE here: this page is public-by-token, and holding open a stream per
  // link would be an easy way to exhaust connections. A slow poll is plenty.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [router]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const headline =
    health === "ok"
      ? `${stageName} is OK`
      : health === "overdue"
        ? `Waiting to hear from ${stageName}`
        : health === "unresponsive" || health === "alarm"
          ? `Our team is trying to reach ${stageName}`
          : `${stageName}'s visit has ended`;

  const tone =
    health === "ok"
      ? "text-success"
      : health === "overdue"
        ? "text-warn"
        : health === "idle"
          ? "text-muted"
          : "text-danger";

  const stateLabel: Record<SafetySessionState, string> = {
    travelling: "On the way to a booking",
    on_site: "At the booking",
    overrun: "Running longer than expected",
    unresponsive: "We've lost contact with their phone",
    heading_home: "Heading home",
    ended: "Finished",
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="card space-y-5 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">
          Cheers safety tracking
        </p>

        <div>
          <p className={`font-display text-2xl ${tone}`}>{headline}</p>
          <p className="mt-2 text-sm text-muted">{stateLabel[state]}</p>
        </div>

        {lastHeartbeatAt && (
          <p className="text-xs text-faint">
            Last signal from their phone{" "}
            {formatAge(Math.round((now - new Date(lastHeartbeatAt).getTime()) / 1000))}{" "}
            ago
          </p>
        )}

        {lastPing ? (
          <a
            className="btn-outline w-full"
            href={`https://www.google.com/maps?q=${lastPing.lat},${lastPing.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            See last known position
          </a>
        ) : (
          <p className="text-xs text-faint">No position shared yet.</p>
        )}

        {expectedEndAt && health !== "idle" && (
          <p className="text-xs text-faint">
            Expected to finish around{" "}
            {new Date(expectedEndAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}

        {(health === "unresponsive" || health === "alarm") && (
          <div className="rounded-xl border border-danger/50 bg-danger/5 p-4 text-left">
            <p className="text-sm text-danger">Our safety team is on this.</p>
            <p className="mt-1 text-xs text-muted">
              If you can reach {stageName} directly, please try now. If you
              believe they are in immediate danger, call 119.
            </p>
          </div>
        )}

        <p className="border-t border-hairline pt-4 text-xs text-faint">
          You&apos;re seeing this because {stageName} listed you as a safety
          contact. This link expires shortly after their booking ends. For
          privacy, it never shows who they&apos;re with or where they&apos;re
          working.
        </p>
      </div>
    </main>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}
