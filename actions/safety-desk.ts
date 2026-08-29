"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bookingDrivers,
  bookings,
  monitorShifts,
  safetyAlerts,
  users,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import {
  guardErrorMessage,
  isDriver,
  requireAdmin,
  requireSafetyDesk,
} from "@/lib/guards";
import { notify } from "@/lib/notify";
import { bookingEventNow, publishBooking, publishSafetyDesk } from "@/lib/realtime";
import { sendPush } from "@/lib/safety/push";
import { recordEvent, sessionForBooking } from "@/lib/safety/session";
import type { ActionResult } from "@/types";
import {
  alertActionSchema,
  assignDriverSchema,
  deleteShiftSchema,
  monitorPingSchema,
  revealPinSchema,
  shiftSchema,
} from "@/schemas/safety";

// Everything the safety desk can do. Split from actions/safety.ts so the
// responder surface and the worker surface have visibly different guards:
// every export here starts with requireSafetyDesk (or requireAdmin).

// --- Alert handling ------------------------------------------------------------

// Acknowledging CLAIMS the alert: it names a responder and parks the
// escalation ladder so no further people are paged. It does NOT close the
// alert — "someone is on it" and "it's over" are different facts.
export async function acknowledgeSafetyAlert(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSafetyDesk();
    const parsed = alertActionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [alert] = await db
      .select()
      .from(safetyAlerts)
      .where(eq(safetyAlerts.id, parsed.data.alertId));
    if (!alert) return err(ERR.notFound);
    if (alert.acknowledgedAt) return ok(undefined);

    // CAS on acknowledgedAt: first responder wins the claim, and a second
    // click cannot overwrite who actually took it.
    const claimed = await db
      .update(safetyAlerts)
      .set({
        acknowledgedByUserId: user.id,
        acknowledgedAt: new Date(),
        // Parking the ladder is the whole point of acknowledging.
        nextEscalationAt: null,
      })
      .where(
        and(eq(safetyAlerts.id, alert.id), isNull(safetyAlerts.acknowledgedAt))
      )
      .returning({ id: safetyAlerts.id });
    if (claimed.length === 0) {
      return err("Another responder just claimed this alert.");
    }

    await writeAudit({
      actorUserId: user.id,
      action: "safety_alert.acknowledge",
      entity: "safety_alerts",
      entityId: alert.id,
    });
    await recordEvent({
      sessionId: alert.sessionId,
      bookingId: alert.bookingId,
      kind: "alert_acknowledged",
      actorUserId: user.id,
      payload: { alertId: alert.id },
    });

    publishBooking(alert.bookingId, bookingEventNow("alert"));
    publishSafetyDesk();
    revalidatePath(`/bookings/${alert.bookingId}`);
    revalidatePath("/safety");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function resolveSafetyAlert(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSafetyDesk();
    const parsed = alertActionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [alert] = await db
      .select()
      .from(safetyAlerts)
      .where(eq(safetyAlerts.id, parsed.data.alertId));
    if (!alert) return err(ERR.notFound);
    if (alert.resolvedAt) return ok(undefined);

    const now = new Date();
    await db
      .update(safetyAlerts)
      .set({
        resolvedByUserId: user.id,
        resolvedAt: now,
        resolutionNote: parsed.data.note ?? null,
        nextEscalationAt: null,
        // First touch also counts as acknowledgement.
        acknowledgedByUserId: alert.acknowledgedByUserId ?? user.id,
        acknowledgedAt: alert.acknowledgedAt ?? now,
      })
      .where(eq(safetyAlerts.id, alert.id));

    await writeAudit({
      actorUserId: user.id,
      action: "safety_alert.resolve",
      entity: "safety_alerts",
      entityId: alert.id,
      after: { note: parsed.data.note },
    });
    await recordEvent({
      sessionId: alert.sessionId,
      bookingId: alert.bookingId,
      kind: "alert_resolved",
      actorUserId: user.id,
      payload: { alertId: alert.id, note: parsed.data.note ?? null },
    });

    publishBooking(alert.bookingId, bookingEventNow("alert"));
    publishSafetyDesk();
    revalidatePath(`/bookings/${alert.bookingId}`);
    revalidatePath("/safety");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Proactive monitoring ---------------------------------------------------------

// "How's it going?" — a monitor nudging a worker who looks quiet but has not
// yet missed anything. Cheap, human, and often resolves a worry before it
// becomes an escalation.
export async function pingWorker(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireSafetyDesk();
    const parsed = monitorPingSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [row] = await db
      .select({ booking: bookings })
      .from(bookings)
      .where(eq(bookings.id, parsed.data.bookingId));
    if (!row) return err(ERR.notFound);

    const session = await sessionForBooking(row.booking.id);
    if (!session) return err("No active safety session for this booking.");

    await notify({
      userId: session.workerUserId,
      type: "safety_ping",
      title: "Safety check from the CheersJA team",
      body:
        parsed.data.message ??
        "Just checking in — tap I'm OK in your booking to confirm you're fine.",
      meta: { bookingId: row.booking.id },
      email: false,
    });
    await sendPush([session.workerUserId], {
      title: "Are you OK?",
      body: parsed.data.message ?? "Tap to confirm you're fine.",
      url: `/bookings/${row.booking.id}`,
      checkin: { bookingId: row.booking.id },
      tag: `checkin-${row.booking.id}`,
      urgent: true,
    });

    await recordEvent({
      sessionId: session.id,
      bookingId: row.booking.id,
      kind: "monitor_ping",
      actorUserId: user.id,
      payload: { message: parsed.data.message ?? null },
    });
    publishBooking(row.booking.id, bookingEventNow("safety"));
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Driver dispatch ------------------------------------------------------------------

// Assigning a driver is what grants them visibility of a booking at all
// (lib/booking-access.ts). It is an access grant, so it is admin-gated and
// audited.
export async function assignDriver(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireAdmin();
    const parsed = assignDriverSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [driver] = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.driverUserId));
    if (!driver || !isDriver(driver) || driver.suspended) {
      return err("That account is not an active driver.");
    }
    const [booking] = await db
      .select({ id: bookings.id, code: bookings.code })
      .from(bookings)
      .where(eq(bookings.id, parsed.data.bookingId));
    if (!booking) return err(ERR.notFound);

    await db
      .insert(bookingDrivers)
      .values({
        bookingId: booking.id,
        driverUserId: driver.id,
        assignedByUserId: user.id,
      })
      .onConflictDoNothing();

    await writeAudit({
      actorUserId: user.id,
      action: "booking.assign_driver",
      entity: "bookings",
      entityId: booking.id,
      after: { driverUserId: driver.id },
    });
    await recordEvent({
      bookingId: booking.id,
      kind: "driver_dispatched",
      actorUserId: user.id,
      payload: { driverUserId: driver.id },
    });
    await notify({
      userId: driver.id,
      type: "driver_assigned",
      title: "You've been assigned a transport job",
      body: `Booking ${booking.code} is now on your schedule.`,
      meta: { bookingId: booking.id },
    });

    revalidatePath("/driver");
    revalidatePath("/safety");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function unassignDriver(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireAdmin();
    const parsed = assignDriverSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    await db
      .delete(bookingDrivers)
      .where(
        and(
          eq(bookingDrivers.bookingId, parsed.data.bookingId),
          eq(bookingDrivers.driverUserId, parsed.data.driverUserId)
        )
      );
    await writeAudit({
      actorUserId: user.id,
      action: "booking.unassign_driver",
      entity: "bookings",
      entityId: parsed.data.bookingId,
      before: { driverUserId: parsed.data.driverUserId },
    });
    revalidatePath("/driver");
    revalidatePath("/safety");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Audited PIN reveal ------------------------------------------------------------------

// The meeting PIN identifies a real person at a door, so it is not rendered
// inline for the whole desk. Revealing it is a deliberate, logged act — "who
// looked at this PIN, and when" must always be answerable.
export async function revealMeetingPin(
  input: unknown
): Promise<ActionResult<{ pin: string }>> {
  try {
    const user = await requireSafetyDesk();
    const parsed = revealPinSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [booking] = await db
      .select({ id: bookings.id, safetyPin: bookings.safetyPin })
      .from(bookings)
      .where(eq(bookings.id, parsed.data.bookingId));
    if (!booking?.safetyPin) return err(ERR.notFound);

    await writeAudit({
      actorUserId: user.id,
      action: "booking.reveal_pin",
      entity: "bookings",
      entityId: booking.id,
    });
    await recordEvent({
      bookingId: booking.id,
      kind: "pin_revealed",
      actorUserId: user.id,
    });
    // The duress PIN is deliberately NOT returned here: it belongs to the
    // worker alone, and staff knowing it would defeat its purpose.
    return ok({ pin: booking.safetyPin });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- On-call rota -----------------------------------------------------------------------

export async function createMonitorShift(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = shiftSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    if (endsAt <= startsAt) return err("The shift must end after it starts.");

    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.userId));
    // Anyone who can work the desk can hold a shift; drivers and customers
    // cannot, because they have no way to respond to what they would be paged
    // about.
    if (
      !target ||
      target.suspended ||
      isDriver(target) ||
      (target.role !== "admin" && target.role !== "support")
    ) {
      return err("That account cannot be rostered on the safety desk.");
    }

    await db.insert(monitorShifts).values({
      userId: target.id,
      startsAt,
      endsAt,
      createdByUserId: admin.id,
    });
    await writeAudit({
      actorUserId: admin.id,
      action: "monitor_shift.create",
      entity: "monitor_shifts",
      entityId: target.id,
      after: { startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt },
    });
    revalidatePath("/safety/rota");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function deleteMonitorShift(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = deleteShiftSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    await db.delete(monitorShifts).where(eq(monitorShifts.id, parsed.data.shiftId));
    await writeAudit({
      actorUserId: admin.id,
      action: "monitor_shift.delete",
      entity: "monitor_shifts",
      entityId: parsed.data.shiftId,
    });
    revalidatePath("/safety/rota");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
