"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { safetyAlerts, wellnessChecks } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { loadBookingAccess } from "@/lib/booking-access";
import { transitionBooking } from "@/lib/bookings";
import { guardErrorMessage, requireStaff, requireUser, isDriver } from "@/lib/guards";
import { notify, notifyStaff } from "@/lib/notify";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import type { ActionResult } from "@/types";
import {
  alertActionSchema,
  raiseAlertSchema,
  startServiceSchema,
  wellnessCheckSchema,
} from "@/schemas/safety";

// --- Meeting start: worker verifies the customer's PIN -------------------------

// The customer shares their safety PIN when the worker arrives; a correct PIN
// moves the booking to in_progress. This confirms the right people met and
// starts the wellness-check clock.
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
    if (!access.booking.safetyPin || parsed.data.pin !== access.booking.safetyPin) {
      return err("That PIN doesn't match — ask the customer for their booking PIN.");
    }

    await transitionBooking({
      booking: access.booking,
      to: "in_progress",
      actorUserId: user.id,
      note: "PIN verified at meeting",
    });
    await notify({
      userId: access.booking.customerId,
      type: "booking_started",
      title: `Booking ${access.booking.code} started`,
      body: "PIN verified — your session is now in progress. Safety monitoring is active.",
      meta: { bookingId: access.booking.id },
    });

    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Wellness checks (worker) ---------------------------------------------------

export async function recordWellnessCheck(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = wellnessCheckSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const access = await loadBookingAccess(user, parsed.data.bookingId);
    if (!access) return err(ERR.notFound);
    if (access.viewerRole !== "worker") return err(ERR.forbidden);
    if (
      access.booking.status !== "confirmed" &&
      access.booking.status !== "in_progress"
    ) {
      return err("Wellness checks are only active during a booking.");
    }

    await db.insert(wellnessChecks).values({
      bookingId: access.booking.id,
      userId: user.id,
      status: parsed.data.status,
      note: parsed.data.note,
    });

    if (parsed.data.status === "help") {
      await db.insert(safetyAlerts).values({
        bookingId: access.booking.id,
        raisedByUserId: user.id,
        kind: "wellness_help",
        message: parsed.data.note ?? "Worker requested help via wellness check.",
      });
      // One event per mutation, pushed before the email fan-out — staff
      // watching the room must not wait on SMTP. notifyStaff never throws.
      publishBooking(access.booking.id, bookingEventNow("alert"));
      void notifyStaff({
        type: "safety_alert",
        title: `⚠ Wellness alert — booking ${access.booking.code}`,
        body: `${access.worker.stageName} requested help at ${access.booking.address}. Open the booking room now.`,
        meta: { bookingId: access.booking.id },
      });
    } else {
      publishBooking(access.booking.id, bookingEventNow("wellness"));
    }

    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- SOS (worker or customer) ---------------------------------------------------

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

    await db.insert(safetyAlerts).values({
      bookingId: access.booking.id,
      raisedByUserId: user.id,
      kind: "sos",
      message: parsed.data.message,
    });
    // Push to the room and return to the panicking user immediately; the
    // email fan-out runs behind (notifyStaff never throws).
    publishBooking(access.booking.id, bookingEventNow("alert"));
    void notifyStaff({
      type: "safety_alert",
      title: `🚨 SOS — booking ${access.booking.code}`,
      body: `${access.viewerRole === "worker" ? access.worker.stageName : "The customer"} triggered an emergency alert at ${access.booking.address}.${parsed.data.message ? ` Message: ${parsed.data.message}` : ""}`,
      meta: { bookingId: access.booking.id },
    });

    revalidatePath(`/bookings/${access.booking.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Staff alert handling --------------------------------------------------------

export async function acknowledgeSafetyAlert(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireStaff();
    if (isDriver(user)) return err(ERR.forbidden);
    const parsed = alertActionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [alert] = await db
      .select()
      .from(safetyAlerts)
      .where(eq(safetyAlerts.id, parsed.data.alertId));
    if (!alert) return err(ERR.notFound);
    if (alert.acknowledgedAt) return ok(undefined);

    await db
      .update(safetyAlerts)
      .set({ acknowledgedByUserId: user.id, acknowledgedAt: new Date() })
      .where(eq(safetyAlerts.id, alert.id));
    await writeAudit({
      actorUserId: user.id,
      action: "safety_alert.acknowledge",
      entity: "safety_alerts",
      entityId: alert.id,
    });

    publishBooking(alert.bookingId, bookingEventNow("alert"));
    revalidatePath(`/bookings/${alert.bookingId}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function resolveSafetyAlert(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireStaff();
    if (isDriver(user)) return err(ERR.forbidden);
    const parsed = alertActionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [alert] = await db
      .select()
      .from(safetyAlerts)
      .where(eq(safetyAlerts.id, parsed.data.alertId));
    if (!alert) return err(ERR.notFound);
    if (alert.resolvedAt) return ok(undefined);

    await db
      .update(safetyAlerts)
      .set({
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
        // First touch also counts as acknowledgement.
        acknowledgedByUserId: alert.acknowledgedByUserId ?? user.id,
        acknowledgedAt: alert.acknowledgedAt ?? new Date(),
      })
      .where(eq(safetyAlerts.id, alert.id));
    await writeAudit({
      actorUserId: user.id,
      action: "safety_alert.resolve",
      entity: "safety_alerts",
      entityId: alert.id,
    });

    publishBooking(alert.bookingId, bookingEventNow("alert"));
    revalidatePath(`/bookings/${alert.bookingId}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
