import { createHash, randomBytes } from "crypto";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
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
  CHECKIN_SNOOZE_MINUTES,
  CHECKIN_SNOOZES_PER_SESSION,
  GET_HOME_SAFE_MINUTES,
  HEARTBEAT_GRACE_MINUTES,
  OVERRUN_GRACE_MINUTES,
  resolveCheckinMinutes,
  TRACK_LINK_GRACE_MINUTES,
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

// --- Check-in cadence ------------------------------------------------------------

// THE one place a periodic check-in deadline is computed.
//
// The cadence is the professional's choice, snapshotted onto the booking when
// it was made (bookings.checkin_interval_minutes). Null means they never chose
// and the platform default applies; ZERO means "start and end only" — a
// performer mid-set cannot answer a prompt, and pretending otherwise trains
// people to ignore the one that matters.
//
// Zero returns NULL, and a null nextCheckInAt is the scheduler's "nothing is
// due" — never "overdue". See lib/safety/scheduler.ts dueCheckins, which
// filters on isNotNull(nextCheckInAt) before comparing it to the clock.
export function checkinMinutesFor(booking: BookingRow): number {
  return resolveCheckinMinutes(booking.checkinIntervalMinutes);
}

export function nextCheckInFor(
  booking: BookingRow,
  from: Date = new Date()
): Date | null {
  const minutes = checkinMinutesFor(booking);
  return minutes > 0 ? minutesFromNow(minutes, from) : null;
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
//
// The booking carries the cadence, so it is required here: on a "start and end
// only" job this sets nextCheckInAt to null and no periodic prompt ever fires.
// Everything else about the session is unchanged.
export async function startOnSite(
  session: SafetySessionRow,
  actorUserId: string,
  booking: BookingRow
): Promise<void> {
  const now = new Date();
  const nextCheckInAt = nextCheckInFor(booking, now);
  await db
    .update(safetySessions)
    .set({
      state: "on_site",
      lastHeartbeatAt: now,
      nextCheckInAt,
      updatedAt: now,
    })
    .where(eq(safetySessions.id, session.id));
  await recordEvent({
    sessionId: session.id,
    bookingId: session.bookingId,
    kind: "arrived_on_site",
    actorUserId,
    payload: {
      checkinIntervalMinutes: checkinMinutesFor(booking),
      nextCheckInAt: nextCheckInAt?.toISOString() ?? null,
    },
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
  // Carries the cadence for THIS job — the answered check-in rolls the clock
  // forward by the professional's chosen interval, not a platform constant.
  booking: BookingRow;
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
      // Null on a "start and end only" job: answering voluntarily must not
      // switch periodic check-ins back on for a worker who chose to have none.
      nextCheckInAt: nextCheckInFor(opts.booking, now),
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

// --- Snooze: "I'm on stage, ask me later" ------------------------------------------

// A professional mid-performance physically cannot answer a prompt, and the
// honest options for them today are both bad: miss the check-in and page the
// desk for nothing, or set the gig to "start and end only" and give up the
// periodic cover entirely. Snooze is the middle: pressing it IS contact, so the
// clock moves and nothing escalates.
//
// It moves the PERIODIC CHECK-IN ONLY. Get-home-safe (getHomeDueAt), the
// arrival deadline (expectedArrivalAt), the overrun deadline (expectedEndAt),
// the heartbeat, the SOS and the duress PIN are all untouched by every write
// below — a snooze can never buy silence on any of them.
//
// Capped per session, counted from the append-only safety-event trail rather
// than a column, so the desk sees every snooze in the same timeline as
// everything else and there is no separate counter to drift.
export const SNOOZE_EVENT_KIND = "checkin_snoozed";

export type SnoozeOutcome =
  | { ok: true; remaining: number; nextCheckInAt: Date }
  | { ok: false; reason: "no_cadence" | "cap_reached" };

export async function countSnoozes(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(safetyEvents)
    .where(
      and(
        eq(safetyEvents.sessionId, sessionId),
        eq(safetyEvents.kind, SNOOZE_EVENT_KIND)
      )
    );
  return row?.n ?? 0;
}

export async function snoozeCheckin(opts: {
  session: SafetySessionRow;
  booking: BookingRow;
  actorUserId: string;
}): Promise<SnoozeOutcome> {
  // Nothing to push out on a "start and end only" job — and re-arming a clock
  // the professional switched off would be the opposite of what they asked for.
  if (checkinMinutesFor(opts.booking) <= 0) return { ok: false, reason: "no_cadence" };

  const used = await countSnoozes(opts.session.id);
  if (used >= CHECKIN_SNOOZES_PER_SESSION) return { ok: false, reason: "cap_reached" };

  const now = new Date();
  const nextCheckInAt = minutesFromNow(CHECKIN_SNOOZE_MINUTES, now);
  await db
    .update(safetySessions)
    .set({
      nextCheckInAt,
      // Tapping snooze is a live human on the device, so it counts as contact
      // exactly as answering does — including clearing an unresponsive flag.
      lastHeartbeatAt: now,
      ...(opts.session.state === "unresponsive" ? { state: "on_site" as const } : {}),
      updatedAt: now,
    })
    .where(eq(safetySessions.id, opts.session.id));

  // A check-in already waiting is answered by the act of snoozing. Without
  // this the pending row would still time out minutes later and page the desk
  // about a worker who had just told us they were fine.
  await db
    .update(safetyCheckins)
    .set({
      status: "ok",
      respondedAt: now,
      method: "in_app",
      note: "Snoozed",
    })
    .where(
      and(
        eq(safetyCheckins.sessionId, opts.session.id),
        eq(safetyCheckins.status, "pending")
      )
    );

  await recordEvent({
    sessionId: opts.session.id,
    bookingId: opts.session.bookingId,
    kind: SNOOZE_EVENT_KIND,
    actorUserId: opts.actorUserId,
    payload: {
      minutes: CHECKIN_SNOOZE_MINUTES,
      nextCheckInAt: nextCheckInAt.toISOString(),
      used: used + 1,
      cap: CHECKIN_SNOOZES_PER_SESSION,
    },
  });
  publishSafetyDesk();
  return {
    ok: true,
    remaining: CHECKIN_SNOOZES_PER_SESSION - (used + 1),
    nextCheckInAt,
  };
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
