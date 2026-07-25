import { createHash, randomBytes } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  locationPings,
  safetyAlerts,
  safetyCheckins,
  safetyEvents,
  safetySessions,
} from "@/db/schema";
import {
  GET_HOME_SAFE_MINUTES,
  HEARTBEAT_GRACE_MINUTES,
  OVERRUN_GRACE_MINUTES,
  TRACK_LINK_GRACE_MINUTES,
  WELLNESS_CHECK_INTERVAL_MINUTES,
} from "@/lib/constants";
import { bookingStartDate } from "@/lib/bookings";
import { bookingEventNow, publishBooking, publishSafetyDesk } from "@/lib/realtime";
import type {
  BookingRow,
  SafetyCheckinRow,
  SafetyHealth,
  SafetySessionRow,
} from "@/types";

export const MINUTE_MS = 60_000;

export function minutesFromNow(minutes: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + minutes * MINUTE_MS);
}

// Tokens are stored hashed so a database leak never yields a working tracking
// link. The plaintext exists only in the URL we mail to a trusted contact.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// --- Session lifecycle ---------------------------------------------------------

// Idempotent: returns the existing session for a booking, or creates one.
// Called from the travel start AND from PIN verification, either of which may
// legitimately be the first thing that happens.
//
// `trackToken` is the PLAINTEXT tracking token and is present ONLY on the call
// that created the session — the database stores just its hash, so this is the
// single moment a tracking link can be built. It is a separate field from
// trackTokenHash on purpose: a caller must never be able to confuse the two
// and write the plaintext back to the row.
export async function ensureSession(
  booking: BookingRow,
  workerUserId: string,
  opts: { state?: "travelling" | "on_site"; expectedArrivalAt?: Date | null } = {}
): Promise<SafetySessionRow & { trackToken: string | null }> {
  const [existing] = await db
    .select()
    .from(safetySessions)
    .where(eq(safetySessions.bookingId, booking.id));
  if (existing) return { ...existing, trackToken: null };

  const start = bookingStartDate(booking);
  const expectedEndAt = new Date(
    start.getTime() +
      (booking.durationMinutes + OVERRUN_GRACE_MINUTES) * MINUTE_MS
  );
  const token = generateToken();

  const [created] = await db
    .insert(safetySessions)
    .values({
      bookingId: booking.id,
      workerUserId,
      state: opts.state ?? "travelling",
      expectedEndAt,
      expectedArrivalAt: opts.expectedArrivalAt ?? null,
      lastHeartbeatAt: new Date(),
      trackTokenHash: hashToken(token),
      trackExpiresAt: new Date(
        expectedEndAt.getTime() + TRACK_LINK_GRACE_MINUTES * MINUTE_MS
      ),
    })
    .returning();

  await recordEvent({
    sessionId: created.id,
    bookingId: booking.id,
    kind: "session_started",
    actorUserId: workerUserId,
    payload: { state: created.state },
  });
  publishSafetyDesk();
  return { ...created, trackToken: token };
}

// Moves a session to on-site and starts the check-in clock. The FIRST check-in
// is scheduled a full interval out — a worker who has just walked in should
// not be pinged thirty seconds later.
export async function startOnSite(
  session: SafetySessionRow,
  actorUserId: string
): Promise<void> {
  const now = new Date();
  await db
    .update(safetySessions)
    .set({
      state: "on_site",
      lastHeartbeatAt: now,
      nextCheckInAt: minutesFromNow(WELLNESS_CHECK_INTERVAL_MINUTES, now),
      updatedAt: now,
    })
    .where(eq(safetySessions.id, session.id));
  await recordEvent({
    sessionId: session.id,
    bookingId: session.bookingId,
    kind: "arrived_on_site",
    actorUserId,
  });
  publishSafetyDesk();
}

// The worker says they have left. Safety closure is deliberately NOT the same
// action as completing the booking: completion is gated on payment, and a
// worker leaving in a hurry — or leaving BECAUSE they felt unsafe — must never
// be blocked from closing out their safety session by an unpaid balance.
export async function startHeadingHome(
  session: SafetySessionRow,
  actorUserId: string
): Promise<void> {
  const now = new Date();
  await db
    .update(safetySessions)
    .set({
      state: "heading_home",
      lastHeartbeatAt: now,
      nextCheckInAt: null,
      getHomeDueAt: minutesFromNow(GET_HOME_SAFE_MINUTES, now),
      updatedAt: now,
    })
    .where(eq(safetySessions.id, session.id));
  // Any check-in still pending is moot once they are out of the building.
  await db
    .update(safetyCheckins)
    .set({ status: "ok", respondedAt: now, method: "auto" })
    .where(
      and(
        eq(safetyCheckins.sessionId, session.id),
        eq(safetyCheckins.status, "pending")
      )
    );
  await recordEvent({
    sessionId: session.id,
    bookingId: session.bookingId,
    kind: "left_visit",
    actorUserId,
  });
  publishSafetyDesk();
}

export async function endSession(
  session: SafetySessionRow,
  reason: string,
  actorUserId: string | null
): Promise<void> {
  const now = new Date();
  await db
    .update(safetySessions)
    .set({
      state: "ended",
      endedAt: now,
      endReason: reason,
      nextCheckInAt: null,
      getHomeDueAt: null,
      homeSafeAt: reason === "home_safe" ? now : null,
      trackExpiresAt: new Date(now.getTime() + TRACK_LINK_GRACE_MINUTES * MINUTE_MS),
      updatedAt: now,
    })
    .where(eq(safetySessions.id, session.id));
  await db
    .update(safetyCheckins)
    .set({ status: "ok", respondedAt: now, method: "auto" })
    .where(
      and(
        eq(safetyCheckins.sessionId, session.id),
        eq(safetyCheckins.status, "pending")
      )
    );
  await recordEvent({
    sessionId: session.id,
    bookingId: session.bookingId,
    kind: "session_ended",
    actorUserId,
    payload: { reason },
  });
  publishSafetyDesk();
}

// --- Heartbeat -----------------------------------------------------------------

// A heartbeat proves the worker's device is alive and reachable. Its ABSENCE
// is the alarm, so this is the highest-frequency write in the system: keep it
// to one UPDATE and never let it block on anything slower.
export async function recordHeartbeat(opts: {
  session: SafetySessionRow;
  batteryPct: number | null;
  booking: BookingRow;
}): Promise<void> {
  const now = new Date();
  const wasUnresponsive = opts.session.state === "unresponsive";
  await db
    .update(safetySessions)
    .set({
      lastHeartbeatAt: now,
      lastBatteryPct: opts.batteryPct ?? opts.session.lastBatteryPct,
      // A returning heartbeat clears the alarm state. The lifecycle state is
      // re-derived from the booking rather than remembered, so there is no
      // stale "state before the alarm" to get out of step.
      ...(wasUnresponsive
        ? { state: resumeStateFor(opts.session, opts.booking) }
        : {}),
      updatedAt: now,
    })
    .where(eq(safetySessions.id, opts.session.id));

  if (wasUnresponsive) {
    await recordEvent({
      sessionId: opts.session.id,
      bookingId: opts.session.bookingId,
      kind: "heartbeat_resumed",
      actorUserId: opts.session.workerUserId,
    });
    // Someone is back online — the desk needs to see that immediately.
    publishSafetyDesk();
    publishBooking(opts.session.bookingId, bookingEventNow("safety"));
  }
}

// Where an unresponsive session belongs once contact returns.
function resumeStateFor(
  session: SafetySessionRow,
  booking: BookingRow
): "travelling" | "on_site" | "heading_home" {
  if (session.getHomeDueAt) return "heading_home";
  return booking.status === "in_progress" ? "on_site" : "travelling";
}

// --- Check-ins -------------------------------------------------------------------

export async function pendingCheckin(
  sessionId: string
): Promise<SafetyCheckinRow | null> {
  const [row] = await db
    .select()
    .from(safetyCheckins)
    .where(
      and(
        eq(safetyCheckins.sessionId, sessionId),
        eq(safetyCheckins.status, "pending")
      )
    )
    .orderBy(desc(safetyCheckins.dueAt))
    .limit(1);
  return row ?? null;
}

// Answers a check-in and rolls the clock forward. Returns false when there was
// nothing pending, so callers can treat a duplicate tap as a no-op instead of
// silently scheduling a second interval.
export async function answerCheckin(opts: {
  session: SafetySessionRow;
  status: "ok" | "help";
  method: "in_app" | "push_action";
  covert?: boolean;
  note?: string | null;
}): Promise<boolean> {
  const now = new Date();
  const pending = await pendingCheckin(opts.session.id);

  if (pending) {
    // CAS on status: two taps (screen + notification action) race constantly.
    const claimed = await db
      .update(safetyCheckins)
      .set({
        // A covert "help" must look exactly like an OK anywhere the worker's
        // own screen could render it.
        status: opts.status,
        respondedAt: now,
        method: opts.method,
        covert: opts.covert ?? false,
        note: opts.note ?? null,
      })
      .where(
        and(
          eq(safetyCheckins.id, pending.id),
          eq(safetyCheckins.status, "pending")
        )
      )
      .returning({ id: safetyCheckins.id });
    if (claimed.length === 0) return false;
  } else {
    // Early/voluntary check-in — record it so the trail shows they were fine.
    await db.insert(safetyCheckins).values({
      sessionId: opts.session.id,
      bookingId: opts.session.bookingId,
      dueAt: now,
      status: opts.status,
      respondedAt: now,
      method: opts.method,
      covert: opts.covert ?? false,
      note: opts.note ?? null,
    });
  }

  await db
    .update(safetySessions)
    .set({
      lastHeartbeatAt: now,
      nextCheckInAt: minutesFromNow(WELLNESS_CHECK_INTERVAL_MINUTES, now),
      // An answered check-in IS proof of contact: a session marked
      // unresponsive (screen off, no heartbeats) comes back to on_site the
      // moment the worker answers from the lock screen. If it was actually
      // overrun, the overrun sweep re-flags it next tick (alert deduped).
      ...(opts.session.state === "unresponsive" ? { state: "on_site" as const } : {}),
      updatedAt: now,
    })
    .where(eq(safetySessions.id, opts.session.id));

  await recordEvent({
    sessionId: opts.session.id,
    bookingId: opts.session.bookingId,
    kind: "checkin_answered",
    actorUserId: opts.session.workerUserId,
    payload: { status: opts.status, method: opts.method, covert: opts.covert ?? false },
  });
  return true;
}

// --- Events + breadcrumbs ---------------------------------------------------------

// Append-only. Never throws: the safety trail must not be able to break the
// mutation it is describing.
export async function recordEvent(opts: {
  sessionId?: string | null;
  bookingId: string;
  kind: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(safetyEvents).values({
      sessionId: opts.sessionId ?? null,
      bookingId: opts.bookingId,
      kind: opts.kind,
      actorUserId: opts.actorUserId ?? null,
      payload: opts.payload,
    });
  } catch (error) {
    console.error(
      "safety event write failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function lastPing(
  bookingId: string
): Promise<{ lat: string; lng: string; recordedAt: Date } | null> {
  const [row] = await db
    .select({
      lat: locationPings.lat,
      lng: locationPings.lng,
      recordedAt: locationPings.recordedAt,
    })
    .from(locationPings)
    .where(eq(locationPings.bookingId, bookingId))
    .orderBy(desc(locationPings.recordedAt))
    .limit(1);
  return row ?? null;
}

// --- Health ------------------------------------------------------------------------

// One definition of "how worried should we be", used by the worker's chip, the
// booking room and the safety desk alike. Worst state wins.
export function sessionHealth(opts: {
  session: SafetySessionRow | null;
  openAlerts: number;
  pendingCheckin: SafetyCheckinRow | null;
  now?: Date;
}): SafetyHealth {
  const { session } = opts;
  if (!session || session.state === "ended") {
    return opts.openAlerts > 0 ? "alarm" : "idle";
  }
  if (opts.openAlerts > 0) return "alarm";
  if (session.state === "unresponsive") return "unresponsive";

  const now = opts.now ?? new Date();
  if (
    session.lastHeartbeatAt &&
    now.getTime() - session.lastHeartbeatAt.getTime() >
      HEARTBEAT_GRACE_MINUTES * MINUTE_MS
  ) {
    return "unresponsive";
  }
  if (opts.pendingCheckin && opts.pendingCheckin.dueAt.getTime() <= now.getTime()) {
    return "overdue";
  }
  if (session.state === "overrun") return "overdue";
  return "ok";
}

// Sessions the desk should be watching right now.
export async function activeSessionIds(): Promise<string[]> {
  const rows = await db
    .select({ id: safetySessions.id })
    .from(safetySessions)
    .where(sql`${safetySessions.state} <> 'ended'`);
  return rows.map((r) => r.id);
}

// Open (unresolved) alerts for a booking. Covert alerts are filtered by the
// CALLER based on audience — never drop that filter for a worker-facing view.
export async function openAlertsFor(bookingId: string) {
  return db
    .select()
    .from(safetyAlerts)
    .where(and(eq(safetyAlerts.bookingId, bookingId), isNull(safetyAlerts.resolvedAt)))
    .orderBy(desc(safetyAlerts.createdAt));
}

export async function sessionForBooking(
  bookingId: string
): Promise<SafetySessionRow | null> {
  const [row] = await db
    .select()
    .from(safetySessions)
    .where(eq(safetySessions.bookingId, bookingId));
  return row ?? null;
}

export async function bookingFor(bookingId: string): Promise<BookingRow | null> {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  return row ?? null;
}
