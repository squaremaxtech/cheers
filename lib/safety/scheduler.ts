import { and, eq, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { db, pool } from "@/db";
import { bookings, safetyCheckins, safetySessions } from "@/db/schema";
import {
  ARRIVAL_GRACE_MINUTES,
  CHECKIN_GRACE_MINUTES,
  CHECKIN_REMINDER_MINUTES,
  HEARTBEAT_GRACE_MINUTES,
} from "@/lib/constants";
import { settleDueJobRequests } from "@/lib/jobs";
import { bookingEventNow, publishBooking, publishSafetyDesk } from "@/lib/realtime";
import { advanceDueLadders, raiseAlert } from "@/lib/safety/escalate";
import { sendPush } from "@/lib/safety/push";
import { MINUTE_MS, recordEvent } from "@/lib/safety/session";

// THE SAFETY CLOCK.
//
// Everything time-based in the safety system happens here. Before this module
// existed, "overdue" was a boolean computed while rendering a page — so a
// worker in trouble produced no alert at all unless somebody happened to be
// looking at their booking. This ticker is what makes silence escalate.
//
// Design rules, in order of importance:
//   1. State lives in Postgres, never in memory. A restart mid-tick loses
//      nothing; the next tick picks the work back up.
//   2. Every transition is a compare-and-swap, so a double tick (or a second
//      process) can never fire the same escalation twice.
//   3. Nothing here throws. One bad session must not stop the other sessions
//      from being checked.

const TICK_MS = 30_000;

// A session advisory lock scoped to this app. Even though pm2 runs a single
// fork today, a second instance (or an accidental `next start` alongside pm2)
// would otherwise run two schedulers against one database. The lock makes the
// extra one a no-op instead of a duplicate-page generator.
const SCHEDULER_LOCK_KEY = 4_820_115;

const globalStore = globalThis as unknown as {
  __safetyScheduler?: { timer: ReturnType<typeof setInterval>; running: boolean };
};

export function startSafetyScheduler(): void {
  if (globalStore.__safetyScheduler) return;
  const state = { timer: null as unknown as ReturnType<typeof setInterval>, running: false };
  state.timer = setInterval(() => {
    // Skip if the previous tick is still going — a slow database must not
    // stack overlapping ticks on top of each other.
    if (state.running) return;
    state.running = true;
    void runTick()
      .catch((error) =>
        console.error(
          "safety tick failed:",
          error instanceof Error ? error.message : error
        )
      )
      .finally(() => {
        state.running = false;
      });
  }, TICK_MS);
  // Never hold the process open for a tick.
  state.timer.unref?.();
  globalStore.__safetyScheduler = state;
  console.log(`[safety] scheduler started (tick ${TICK_MS / 1000}s)`);
}

export async function runTick(now: Date = new Date()): Promise<void> {
  const client = await pool.connect();
  let holdsLock = false;
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [SCHEDULER_LOCK_KEY]
    );
    holdsLock = rows[0]?.locked === true;
    // Another process owns the clock this tick. Correct behaviour is to do
    // nothing at all rather than race it.
    if (!holdsLock) return;

    await dueCheckins(now);
    await chaseUnansweredCheckins(now);
    await lostHeartbeats(now);
    await lateArrivals(now);
    await overruns(now);
    await getHomeOverdue(now);
    await advanceDueLadders(now);
    // The marketplace clock rides on the same tick (one process, one lock):
    // "best price" job requests whose offer deadline has passed get their
    // cheapest eligible offer booked. Isolated so it can never delay safety.
    await settleDueJobRequests(now).catch((error) =>
      console.error(
        "job settle tick failed:",
        error instanceof Error ? error.message : error
      )
    );
  } finally {
    if (holdsLock) {
      await client
        .query("SELECT pg_advisory_unlock($1)", [SCHEDULER_LOCK_KEY])
        .catch(() => undefined);
    }
    client.release();
  }
}

// 1. Sessions whose next check-in has come due → create the pending row and
//    ping the worker. The row is what later stages chase.
//
//    Includes overrun and unresponsive sessions: a session running late or a
//    phone gone quiet is MORE reason to keep demanding check-ins, not less —
//    an unanswered one is what feeds the staff ladder.
async function dueCheckins(now: Date): Promise<void> {
  const sessions = await db
    .select()
    .from(safetySessions)
    .where(
      and(
        inArray(safetySessions.state, ["on_site", "overrun", "unresponsive"]),
        isNotNull(safetySessions.nextCheckInAt),
        lte(safetySessions.nextCheckInAt, now)
      )
    );

  for (const session of sessions) {
    // CAS: clearing nextCheckInAt claims this session for exactly one tick.
    const claimed = await db
      .update(safetySessions)
      .set({ nextCheckInAt: null, updatedAt: now })
      .where(
        and(
          eq(safetySessions.id, session.id),
          eq(safetySessions.nextCheckInAt, session.nextCheckInAt!)
        )
      )
      .returning({ id: safetySessions.id });
    if (claimed.length === 0) continue;

    const [checkin] = await db
      .insert(safetyCheckins)
      .values({
        sessionId: session.id,
        bookingId: session.bookingId,
        dueAt: session.nextCheckInAt!,
        remindersSent: 1,
      })
      .returning();

    await recordEvent({
      sessionId: session.id,
      bookingId: session.bookingId,
      kind: "checkin_due",
      payload: { checkinId: checkin.id },
    });
    await pingWorkerForCheckin(session.workerUserId, session.bookingId, 0);
    publishBooking(session.bookingId, bookingEventNow("safety"));
  }
  if (sessions.length > 0) publishSafetyDesk();
}

// 2. Pending check-ins: re-ping inside the grace window, then hand off to the
//    staff ladder once the window closes.
async function chaseUnansweredCheckins(now: Date): Promise<void> {
  const pending = await db
    .select({ checkin: safetyCheckins, session: safetySessions })
    .from(safetyCheckins)
    .innerJoin(safetySessions, eq(safetyCheckins.sessionId, safetySessions.id))
    .where(eq(safetyCheckins.status, "pending"));

  for (const { checkin, session } of pending) {
    const overdueMs = now.getTime() - checkin.dueAt.getTime();
    if (overdueMs < 0) continue;

    if (overdueMs >= CHECKIN_GRACE_MINUTES * MINUTE_MS) {
      // CAS to 'missed' — whoever flips it owns raising the alert.
      const claimed = await db
        .update(safetyCheckins)
        .set({ status: "missed" })
        .where(
          and(eq(safetyCheckins.id, checkin.id), eq(safetyCheckins.status, "pending"))
        )
        .returning({ id: safetyCheckins.id });
      if (claimed.length === 0) continue;

      await recordEvent({
        sessionId: session.id,
        bookingId: session.bookingId,
        kind: "checkin_missed",
        payload: { checkinId: checkin.id, overdueMinutes: Math.round(overdueMs / MINUTE_MS) },
      });
      // A missed check-in from a phone that is ALSO silent is the true
      // emergency shape — the worker did not answer and their device cannot be
      // reached. Label it 'unresponsive' so the desk triages it first.
      const silent = session.state === "unresponsive";
      await raiseAlert({
        bookingId: session.bookingId,
        sessionId: session.id,
        kind: silent ? "unresponsive" : "missed_checkin",
        message: silent
          ? `No answer ${Math.round(overdueMs / MINUTE_MS)} min past a due check-in, and no signal from the phone.`
          : `No answer ${Math.round(overdueMs / MINUTE_MS)} min past a due check-in.`,
      });
      // Reschedule so the worker keeps being asked even while staff respond —
      // an answered check-in is the fastest possible all-clear.
      await db
        .update(safetySessions)
        .set({
          nextCheckInAt: new Date(now.getTime() + CHECKIN_GRACE_MINUTES * MINUTE_MS),
          updatedAt: now,
        })
        .where(eq(safetySessions.id, session.id));
      continue;
    }

    // Still inside the window: fire the next reminder if one is due.
    const nextReminder = CHECKIN_REMINDER_MINUTES[checkin.remindersSent];
    if (
      nextReminder !== undefined &&
      overdueMs >= nextReminder * MINUTE_MS
    ) {
      const claimed = await db
        .update(safetyCheckins)
        .set({ remindersSent: checkin.remindersSent + 1 })
        .where(
          and(
            eq(safetyCheckins.id, checkin.id),
            eq(safetyCheckins.remindersSent, checkin.remindersSent)
          )
        )
        .returning({ id: safetyCheckins.id });
      if (claimed.length === 0) continue;
      await pingWorkerForCheckin(
        session.workerUserId,
        session.bookingId,
        checkin.remindersSent
      );
    }
  }
}

// 3. The passive signal. No heartbeat means the phone's screen is off — which
//    is USUALLY routine (a phone lives in a pocket while the worker works, or
//    in a bag while they drive). So heartbeat loss marks the session
//    `unresponsive` and lights the desk board, but does NOT page anyone by
//    itself: auto-paging on every locked screen would bury the desk in false
//    alarms and teach monitors to ignore the real one.
//
//    The ENFORCED alarm stays with the check-in pipeline: check-ins arrive as
//    push notifications answerable from the lock screen, so a pocketed phone
//    still answers — and a missed check-in from a silent phone escalates as
//    'unresponsive' (see chaseUnansweredCheckins). Monitors can also ping a
//    NO SIGNAL session off the board at any moment.
async function lostHeartbeats(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - HEARTBEAT_GRACE_MINUTES * MINUTE_MS);
  const stale = await db
    .select()
    .from(safetySessions)
    .where(
      and(
        inArray(safetySessions.state, [
          "travelling",
          "on_site",
          "overrun",
          "heading_home",
        ]),
        isNotNull(safetySessions.lastHeartbeatAt),
        lte(safetySessions.lastHeartbeatAt, cutoff)
      )
    );

  let flipped = 0;
  for (const session of stale) {
    const claimed = await db
      .update(safetySessions)
      .set({ state: "unresponsive", updatedAt: now })
      .where(
        and(
          eq(safetySessions.id, session.id),
          ne(safetySessions.state, "unresponsive")
        )
      )
      .returning({ id: safetySessions.id });
    if (claimed.length === 0) continue;
    flipped++;

    await recordEvent({
      sessionId: session.id,
      bookingId: session.bookingId,
      kind: "heartbeat_lost",
      payload: {
        lastHeartbeatAt: session.lastHeartbeatAt?.toISOString() ?? null,
        lastBatteryPct: session.lastBatteryPct,
        priorState: session.state,
      },
    });
    publishBooking(session.bookingId, bookingEventNow("safety"));
  }
  if (flipped > 0) publishSafetyDesk();
}

// 4. Declared an ETA and never arrived.
//
//    Matches unresponsive sessions too — a session that went silent en route
//    must still trip its arrival deadline, or flipping to `unresponsive`
//    would quietly disarm it. "Actually arrived" is derived from the booking
//    (PIN start moves it to in_progress), not from the session state.
async function lateArrivals(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - ARRIVAL_GRACE_MINUTES * MINUTE_MS);
  const late = await db
    .select({ session: safetySessions })
    .from(safetySessions)
    .innerJoin(bookings, eq(safetySessions.bookingId, bookings.id))
    .where(
      and(
        inArray(safetySessions.state, ["travelling", "unresponsive"]),
        eq(bookings.status, "confirmed"),
        isNotNull(safetySessions.expectedArrivalAt),
        lte(safetySessions.expectedArrivalAt, cutoff)
      )
    );
  for (const { session } of late) {
    // raiseAlert dedupes per (session, kind) while open — one page, not one
    // per tick.
    await raiseAlert({
      bookingId: session.bookingId,
      sessionId: session.id,
      kind: "no_arrival",
      message:
        session.state === "unresponsive"
          ? "Did not confirm arrival by the expected time, and the phone has gone quiet."
          : "Did not confirm arrival by the expected time.",
    });
  }
}

// 5. Ran past the expected end without closing out. Unresponsive sessions
//    still qualify (their silence must not disarm the deadline); only the
//    on_site → overrun state flip is skipped for them, since `unresponsive`
//    is the more urgent label to keep.
async function overruns(now: Date): Promise<void> {
  const over = await db
    .select({ session: safetySessions })
    .from(safetySessions)
    .innerJoin(bookings, eq(safetySessions.bookingId, bookings.id))
    .where(
      and(
        inArray(safetySessions.state, ["on_site", "unresponsive"]),
        eq(bookings.status, "in_progress"),
        isNull(safetySessions.getHomeDueAt),
        isNotNull(safetySessions.expectedEndAt),
        lte(safetySessions.expectedEndAt, now)
      )
    );

  for (const { session } of over) {
    if (session.state === "on_site") {
      const claimed = await db
        .update(safetySessions)
        .set({ state: "overrun", updatedAt: now })
        .where(
          and(eq(safetySessions.id, session.id), eq(safetySessions.state, "on_site"))
        )
        .returning({ id: safetySessions.id });
      if (claimed.length > 0) {
        await recordEvent({
          sessionId: session.id,
          bookingId: session.bookingId,
          kind: "overrun",
        });
      }
    }
    // Deduped per (session, kind) while open — fires once either way.
    await raiseAlert({
      bookingId: session.bookingId,
      sessionId: session.id,
      kind: "overrun",
      message: "Session ran past its expected end and has not been closed out.",
    });
    publishBooking(session.bookingId, bookingEventNow("safety"));
  }
}

// 6. Travelling home is a real risk window: left the visit but never confirmed
//    getting home. Unresponsive sessions keep their deadline (getHomeDueAt is
//    only ever set by leaving the visit, so the filter is unambiguous).
async function getHomeOverdue(now: Date): Promise<void> {
  const overdue = await db
    .select()
    .from(safetySessions)
    .where(
      and(
        inArray(safetySessions.state, ["heading_home", "unresponsive"]),
        isNotNull(safetySessions.getHomeDueAt),
        lte(safetySessions.getHomeDueAt, now)
      )
    );
  for (const session of overdue) {
    // Clearing the deadline claims it, so this fires exactly once.
    const claimed = await db
      .update(safetySessions)
      .set({ getHomeDueAt: null, updatedAt: now })
      .where(
        and(
          eq(safetySessions.id, session.id),
          eq(safetySessions.getHomeDueAt, session.getHomeDueAt!)
        )
      )
      .returning({ id: safetySessions.id });
    if (claimed.length === 0) continue;

    await raiseAlert({
      bookingId: session.bookingId,
      sessionId: session.id,
      kind: "get_home_overdue",
      message: "Left the visit but never confirmed getting home safely.",
    });
  }
}

// The worker-facing half of the ladder. Kept deliberately vague: a push payload
// travels through a third-party service and may land on a lock screen that a
// stranger can read.
async function pingWorkerForCheckin(
  workerUserId: string,
  bookingId: string,
  reminderIndex: number
): Promise<void> {
  await sendPush([workerUserId], {
    title: reminderIndex === 0 ? "Safety check-in" : "Still there? Please check in",
    body:
      reminderIndex === 0
        ? "Tap I'm OK to confirm you're fine."
        : "We haven't heard from you. Tap to confirm you're OK.",
    url: `/bookings/${bookingId}`,
    checkin: { bookingId },
    tag: `checkin-${bookingId}`,
    urgent: true,
  });
}
