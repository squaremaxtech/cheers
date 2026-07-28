"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  pushSubscriptions,
  safetyAlerts,
  trustedContacts,
  wellnessChecks,
  workerCustomerBlocks,
  workers,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { loadBookingAccess } from "@/lib/booking-access";
import { transitionBooking } from "@/lib/bookings";
import {
  MAX_TRUSTED_CONTACTS,
  PIN_ATTEMPTS_PER_MINUTE,
  PIN_FAILURES_BEFORE_ALERT,
  PIN_LOCKOUT_MINUTES,
  PUSH_SUBSCRIBES_PER_HOUR,
  SOS_PER_HOUR,
  smsEnabled,
  TRUSTED_CONTACTS_PER_DAY,
} from "@/lib/constants";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { bookingEventNow, publishBooking, publishSafetyDesk } from "@/lib/realtime";
import {
  sendContactConfirmation,
  sendTrackingLinks,
} from "@/lib/safety/contacts";
import { raiseAlert } from "@/lib/safety/escalate";
import { pinsMatch, hashPin } from "@/lib/safety/pins";
import { isAllowedPushEndpoint, removeSubscription } from "@/lib/safety/push";
import {
  answerCheckin,
  endSession,
  ensureSession,
  generateToken,
  hashToken,
  minutesFromNow,
  recordEvent,
  sessionForBooking,
  startHeadingHome,
  startOnSite,
} from "@/lib/safety/session";
import type { ActionResult } from "@/types";
import {
  blockCustomerSchema,
  checkinResponseSchema,
  endSessionSchema,
  postVisitFlagSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  raiseAlertSchema,
  removeTrustedContactSchema,
  setCancelPinSchema,
  startServiceSchema,
  startTravelSchema,
  trustedContactSchema,
  wellnessCheckSchema,
} from "@/schemas/safety";

// --- Travel: "I'm on my way" ---------------------------------------------------

// Opens the monitored session before the worker has arrived. The journey to a
// stranger's address is a risk window in its own right, and it is the one the
// platform used to be entirely blind to.
export async function startTravelling(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = startTravelSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker") return err(ERR.forbidden);
    if (access.booking.status !== "confirmed") {
      return err("Only a confirmed booking can be started.");
    }

    const session = await ensureSession(access.booking, user.id, {
      state: "travelling",
      expectedArrivalAt: minutesFromNow(parsed.data.etaMinutes),
    });
    // The plaintext tracking token exists only on the creating call, so this
    // is the one moment a tracking link can be sent.
    await sendTrackingLinks(user.id, {
      stageName: access.worker.stageName,
      token: session.trackToken,
    });

    await recordEvent({
      sessionId: session.id,
      bookingId: access.booking.id,
      kind: "travel_started",
      actorUserId: user.id,
      payload: { etaMinutes: parsed.data.etaMinutes },
    });
    publishBooking(access.booking.id, bookingEventNow("safety"));
    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Meeting start: worker verifies the customer's PIN -------------------------

// The customer shares their safety PIN when the worker arrives; a correct PIN
// moves the booking to in_progress and starts the check-in clock.
//
// The booking ALSO carries a duress PIN, known only to the assigned worker.
// Entering it does everything a correct PIN does — same transition, same
// toast, same screen — while silently raising a covert alert. Someone standing
// over the worker's shoulder sees a normal, successful arrival.
export async function startServiceWithPin(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = startServiceSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker" && user.role !== "admin") {
      return err(ERR.forbidden);
    }
    if (access.booking.status !== "confirmed") {
      return err("Only confirmed bookings can be started.");
    }

    // Brute-force protection: 10,000 PINs fall in minutes to an unthrottled
    // endpoint. Keyed per BOOKING, not per user, so one door cannot be worked
    // on from several sessions at once.
    if (!rateLimit(`pin:${access.booking.id}`, PIN_ATTEMPTS_PER_MINUTE, 60_000)) {
      return err("Too many attempts. Wait a moment and try again.");
    }
    // The lockout counts FAILURES only — a legitimate worker's correct entry
    // must never eat into the budget.
    if (pinFailureCount(access.booking.id) >= PIN_FAILURES_BEFORE_ALERT) {
      return err("PIN entry is locked for this booking. Our team has been alerted.");
    }

    const duress =
      access.booking.duressPin !== null &&
      pinsMatch(parsed.data.pin, access.booking.duressPin);
    const correct =
      duress || pinsMatch(parsed.data.pin, access.booking.safetyPin);

    if (!correct) {
      const failures = recordPinFailure(access.booking.id);
      if (failures === PIN_FAILURES_BEFORE_ALERT) {
        // Fires once, on the threshold — not on every attempt after it.
        await raiseAlert({
          bookingId: access.booking.id,
          kind: "pin_failures",
          message: `${failures} wrong PINs entered at the door.`,
          raisedByUserId: user.id,
        });
      }
      return err("That PIN doesn't match — ask the customer for their booking PIN.");
    }
    // A good entry clears the slate.
    pinFailures.delete(access.booking.id);

    await transitionBooking({
      booking: access.booking,
      to: "in_progress",
      actorUserId: user.id,
      note: "PIN verified at meeting",
    });

    // The session belongs to the WORKER, not the actor — an admin may start a
    // booking on the worker's behalf, and every check-in ping must still reach
    // the worker's devices, never the admin's.
    const session = await ensureSession(access.booking, access.worker.userId, {
      state: "on_site",
    });
    await startOnSite(session, user.id);

    // A worker may go straight to the door without ever tapping "I'm on my
    // way". If THIS call created the session, the tracking token exists only
    // right now — send the trusted-contact links or they never go out.
    if (session.trackToken) {
      await sendTrackingLinks(access.worker.userId, {
        stageName: access.worker.stageName,
        token: session.trackToken,
      });
    }

    if (duress) {
      // Covert: nothing about this alert may surface on the worker's screen.
      await recordEvent({
        sessionId: session.id,
        bookingId: access.booking.id,
        kind: "duress_pin",
        actorUserId: user.id,
      });
      await raiseAlert({
        bookingId: access.booking.id,
        sessionId: session.id,
        kind: "duress",
        message: "Duress PIN entered at the door. Do NOT call the worker's phone.",
        raisedByUserId: user.id,
        covert: true,
      });
    }

    await notify({
      userId: access.booking.customerId,
      type: "booking_started",
      title: `Booking ${access.booking.code} started`,
      body: "PIN verified — your session is now in progress. Safety monitoring is active.",
      meta: { bookingId: access.booking.id },
    });

    revalidatePath(`/bookings/${access.booking.id}`);
    // The response is byte-identical whether or not this was a duress entry.
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Consecutive wrong-PIN counter, kept separate from the sliding rate limiter
// so a correct entry never consumes the lockout budget. In-process like
// lib/rate-limit.ts (single pm2 fork), and swept so a long-running server does
// not accumulate one entry per booking forever.
const pinFailures = new Map<string, { count: number; at: number }>();

function sweepPinFailures(now: number): void {
  if (pinFailures.size < 500) return;
  const window = PIN_LOCKOUT_MINUTES * 60_000;
  for (const [key, value] of pinFailures) {
    if (now - value.at > window) pinFailures.delete(key);
  }
}

function pinFailureCount(bookingId: string): number {
  const current = pinFailures.get(bookingId);
  if (!current) return 0;
  // Expired window: the lockout has served its time.
  if (Date.now() - current.at > PIN_LOCKOUT_MINUTES * 60_000) {
    pinFailures.delete(bookingId);
    return 0;
  }
  return current.count;
}

function recordPinFailure(bookingId: string): number {
  const now = Date.now();
  sweepPinFailures(now);
  const count = pinFailureCount(bookingId) + 1;
  pinFailures.set(bookingId, { count, at: now });
  return count;
}

// --- Check-ins -------------------------------------------------------------------

// Answers the current check-in. Called from the safety bar AND from the push
// notification action, so it must be safe to invoke twice.
export async function respondToCheckin(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = checkinResponseSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker") return err(ERR.forbidden);

    const session = await sessionForBooking(access.booking.id);
    if (!session || session.state === "ended") {
      return err("There is no active safety session for this booking.");
    }

    const covert = parsed.data.covert === true;
    await answerCheckin({
      session,
      status: parsed.data.status,
      method: parsed.data.method,
      covert,
      note: parsed.data.note ?? null,
    });

    if (parsed.data.status === "help") {
      await raiseAlert({
        bookingId: access.booking.id,
        sessionId: session.id,
        kind: "wellness_help",
        message:
          parsed.data.note ??
          (covert
            ? "Quiet help request — worker cannot speak freely."
            : "Worker requested help via check-in."),
        raisedByUserId: user.id,
        covert,
      });
    }

    // Legacy wellness log keeps working so historical records stay continuous.
    //
    // A COVERT request is logged as "ok" here on purpose. This table is
    // rendered in the booking room, where the worker's own screen may be in
    // someone else's view — a visible "requested help" would betray the very
    // thing the quiet option exists to hide. The real record lives on the
    // check-in row and the covert alert, both desk-only.
    await db.insert(wellnessChecks).values({
      bookingId: access.booking.id,
      userId: user.id,
      status: covert ? "ok" : parsed.data.status,
      note: covert ? null : parsed.data.note,
    });

    publishBooking(access.booking.id, bookingEventNow("safety"));
    publishSafetyDesk();
    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Retained for the existing wellness UI; delegates to the check-in path so
// there is exactly one code path that answers a check-in.
export async function recordWellnessCheck(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = wellnessCheckSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
  }
  return respondToCheckin({
    bookingId: parsed.data.bookingId,
    status: parsed.data.status,
    method: parsed.data.method ?? "in_app",
    covert: parsed.data.covert,
    note: parsed.data.note,
  });
}

// --- SOS ---------------------------------------------------------------------------

export async function raiseSafetyAlert(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = raiseAlertSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker" && access.viewerRole !== "customer") {
      return err(ERR.forbidden);
    }
    // An SOS on a finished booking is noise that would bury a real one.
    const live =
      access.booking.status === "confirmed" ||
      access.booking.status === "in_progress";
    if (!live) return err("This booking is not active.");

    // Deliberately generous: a real emergency may legitimately fire more than
    // once, but an automated flood must not drown the desk.
    if (!rateLimit(`sos:${user.id}`, SOS_PER_HOUR, 3_600_000)) {
      return err("Too many alerts raised. Our team is already notified — call 119 if you are in danger.");
    }

    const session = await sessionForBooking(access.booking.id);
    await raiseAlert({
      bookingId: access.booking.id,
      sessionId: session?.id ?? null,
      kind: "sos",
      message: parsed.data.message ?? null,
      raisedByUserId: user.id,
    });

    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Records that a countdown was armed then cancelled. Not an alert, but very
// much worth keeping: a pattern of armed-and-cancelled alarms is a signal.
export async function recordSosCancelled(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = raiseAlertSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker" && access.viewerRole !== "customer") {
      return err(ERR.forbidden);
    }
    const session = await sessionForBooking(access.booking.id);
    await recordEvent({
      sessionId: session?.id ?? null,
      bookingId: access.booking.id,
      kind: "sos_cancelled",
      actorUserId: user.id,
    });
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Ending a session --------------------------------------------------------------

// Closing out safety is INDEPENDENT of completing the booking. Completion is
// gated on payment being recorded; safety closure must never be, or a worker
// leaving in a hurry (or leaving because they felt unsafe) would be stuck
// inside a monitored session by an unpaid balance.
export async function endSafetySession(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = endSessionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker") return err(ERR.forbidden);

    const session = await sessionForBooking(access.booking.id);
    if (!session) return err("There is no safety session for this booking.");
    if (session.state === "ended") return ok(undefined);

    if (parsed.data.reason === "left_visit") {
      // Starts the get-home-safe timer rather than ending monitoring: the
      // journey home is exactly when a worker is alone and least watched.
      await startHeadingHome(session, user.id);
    } else {
      await endSession(session, parsed.data.reason, user.id);
    }

    publishBooking(access.booking.id, bookingEventNow("safety"));
    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Post-visit private flag ---------------------------------------------------------

// Never visible to the customer. Feeds the risk summary other workers see.
export async function flagVisit(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = postVisitFlagSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker") return err(ERR.forbidden);

    const session = await sessionForBooking(access.booking.id);
    await recordEvent({
      sessionId: session?.id ?? null,
      bookingId: access.booking.id,
      kind: "post_visit_flag",
      actorUserId: user.id,
      payload: { feltUnsafe: parsed.data.feltUnsafe, note: parsed.data.note ?? null },
    });

    if (parsed.data.feltUnsafe) {
      // Not an emergency (the visit is over) but staff must see it, so it
      // lands as an unresolved alert on the desk rather than in a log nobody
      // reads.
      await db.insert(safetyAlerts).values({
        bookingId: access.booking.id,
        sessionId: session?.id ?? null,
        raisedByUserId: user.id,
        kind: "other",
        message: `Post-visit report: worker felt unsafe.${parsed.data.note ? ` ${parsed.data.note}` : ""}`,
      });
      publishSafetyDesk();
    }

    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// A worker's private "never again". The customer is never told — a blocked
// pairing simply reports the worker as unavailable at booking time.
export async function blockCustomer(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = blockCustomerSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker") return err(ERR.forbidden);

    await db
      .insert(workerCustomerBlocks)
      .values({
        workerId: access.worker.id,
        customerId: access.booking.customerId,
        reason: parsed.data.reason,
      })
      .onConflictDoNothing();

    revalidatePath("/worker/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Web push subscriptions -----------------------------------------------------------

export async function subscribeToPush(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = pushSubscribeSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    if (!rateLimit(`push-sub:${user.id}`, PUSH_SUBSCRIBES_PER_HOUR, 3_600_000)) {
      return err("Too many attempts. Try again shortly.");
    }
    // The server will POST to this URL on every alert. Anything not on the
    // allowlist of real push services is an SSRF attempt, not a subscription.
    if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
      return err("That push endpoint is not supported.");
    }

    await db
      .insert(pushSubscriptions)
      .values({
        userId: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        // Re-subscribing on a shared device must move the endpoint to the
        // current user, never leave alerts pointed at the previous one.
        set: {
          userId: user.id,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          lastSeenAt: new Date(),
        },
      });
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function unsubscribeFromPush(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = pushUnsubscribeSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    await removeSubscription(user.id, parsed.data.endpoint);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Worker safety settings ------------------------------------------------------------

// The code that cancels an armed SOS countdown. Stored hashed so nobody with
// database access can silence a live alarm.
export async function setCancelPin(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = setCancelPinSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [worker] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.userId, user.id));
    if (!worker) return err(ERR.forbidden);

    await db
      .update(workers)
      .set({ cancelPinHash: await hashPin(parsed.data.cancelPin), updatedAt: new Date() })
      .where(eq(workers.id, worker.id));
    revalidatePath("/worker/safety");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function addTrustedContact(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = trustedContactSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    if (!rateLimit(`contact:${user.id}`, TRUSTED_CONTACTS_PER_DAY, 86_400_000)) {
      return err("Too many contact changes today. Try again tomorrow.");
    }

    const existing = await db
      .select({ id: trustedContacts.id })
      .from(trustedContacts)
      .where(eq(trustedContacts.userId, user.id));
    if (existing.length >= MAX_TRUSTED_CONTACTS) {
      return err(`You can have up to ${MAX_TRUSTED_CONTACTS} trusted contacts.`);
    }

    const email = parsed.data.email || null;
    const phone = parsed.data.phone || null;

    // Refuse a contact we cannot actually confirm or reach. A phone-only
    // contact added while SMS is unconfigured could never be verified and so
    // could never be notified — it would sit in the worker's list looking like
    // cover while being nothing at all. Say so now rather than at 2am.
    if (!email && !smsEnabled()) {
      return err(
        "Text messaging isn't switched on yet, so we can only confirm contacts by email. Add an email address for this person."
      );
    }

    const token = generateToken();
    await db.insert(trustedContacts).values({
      userId: user.id,
      name: parsed.data.name,
      email,
      phone,
      notifyOn: parsed.data.notifyOn,
      verifyTokenHash: hashToken(token),
      verifyExpiresAt: minutesFromNow(60 * 24 * 7),
    });

    // Consent before contact: someone must agree to be an emergency contact
    // before we start sending them alarming messages at 3am. The link goes out
    // on every channel we have for them.
    await sendContactConfirmation({
      contactName: parsed.data.name,
      email,
      phone,
      workerName: user.name ?? "A Cheers worker",
      token,
    });

    revalidatePath("/worker/safety");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function removeTrustedContact(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = removeTrustedContactSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    // Scoped by userId as well as id — without it, any signed-in account could
    // delete anyone's emergency contacts by guessing a uuid.
    await db
      .delete(trustedContacts)
      .where(
        and(
          eq(trustedContacts.id, parsed.data.contactId),
          eq(trustedContacts.userId, user.id)
        )
      );
    revalidatePath("/worker/safety");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// The trusted-contact fan-out lives in lib/safety/contacts.ts — one module owns
// every message that leaves the platform for a worker's own people, so the
// "never the customer's identity, never the address" boundary cannot drift
// apart between the session-start link, the overdue warning and the ladder.
