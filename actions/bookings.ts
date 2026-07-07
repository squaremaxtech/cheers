"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bookingEvents,
  bookings,
  payments,
  serviceAddons,
  serviceTypes,
  workers,
  workerServices,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import {
  canTransition,
  customerCanCancel,
  generateBookingCode,
  generateSafetyPin,
  parseBookingStart,
  transitionBooking,
} from "@/lib/bookings";
import { BOOKING_DURATIONS_MINUTES, platformFeeCents } from "@/lib/constants";
import { refundBookingPayments } from "@/lib/refunds";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import type { ActionResult, BookingRow, TimeSlot, UserRow } from "@/types";
import { hasMembershipAccess } from "@/lib/membership";
import { notify, notifyAdmins } from "@/lib/notify";
import { isCustomerVerified } from "@/lib/verification";
import {
  bookingDatesSchema,
  bookingDecisionSchema,
  bookingSlotsSchema,
  cancelBookingSchema,
  createBookingSchema,
  reassignBookingSchema,
  rescheduleBookingSchema,
} from "@/schemas/booking";
import {
  getAvailableDates,
  getTimeSlots,
  lockWorkerSchedule,
  slotConflictError,
} from "@/lib/availability";

// Resolve a booking plus the actor's relationship to it.
async function loadBookingFor(user: UserRow, bookingId: string) {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (!booking) return null;

  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.id, booking.workerId));

  const isCustomer = booking.customerId === user.id;
  const isWorker = worker?.userId === user.id;
  const isAdmin = user.role === "admin";
  return { booking, worker, isCustomer, isWorker, isAdmin };
}

async function notifyBookingParties(
  booking: BookingRow,
  opts: {
    type: string;
    customer?: { title: string; body: string };
    worker?: { title: string; body: string };
    admins?: { title: string; body: string };
  }
): Promise<void> {
  const meta = { bookingId: booking.id, code: booking.code };
  if (opts.customer) {
    await notify({ userId: booking.customerId, type: opts.type, meta, ...opts.customer });
  }
  if (opts.worker) {
    const [worker] = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(eq(workers.id, booking.workerId));
    if (worker) {
      await notify({ userId: worker.userId, type: opts.type, meta, ...opts.worker });
    }
  }
  if (opts.admins) {
    await notifyAdmins({ type: opts.type, meta, ...opts.admins });
  }
}

// --- Slots (customer picks from these when booking) ----------------------------

// The bookable start times for a worker on one date. States: available /
// pending (another customer's live request holds it) / booked.
export async function getBookingSlots(
  input: unknown
): Promise<ActionResult<{ slots: TimeSlot[] }>> {
  try {
    await requireUser();
    const parsed = bookingSlotsSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const { workerId, date, durationMinutes, excludeBookingId } = parsed.data;
    const slots = await getTimeSlots(
      workerId,
      date,
      durationMinutes,
      excludeBookingId
    );
    return ok({ slots });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// The dates in one calendar month that still have at least one open slot for
// the duration — the booking calendar greys out everything else.
export async function getBookingDates(
  input: unknown
): Promise<ActionResult<{ dates: string[] }>> {
  try {
    await requireUser();
    const parsed = bookingDatesSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const { workerId, month, durationMinutes, excludeBookingId } = parsed.data;

    const first = new Date(`${month}-01T00:00:00Z`);
    if (Number.isNaN(first.getTime())) return err(ERR.badRequest);
    const last = new Date(first);
    last.setUTCMonth(last.getUTCMonth() + 1);
    last.setUTCDate(0); // last day of `month`

    const dates = await getAvailableDates(
      workerId,
      durationMinutes,
      first.toISOString().slice(0, 10),
      last.toISOString().slice(0, 10),
      excludeBookingId
    );
    return ok({ dates });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Create (customer) --------------------------------------------------------

export async function createBooking(
  input: unknown
): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const user = await requireUser();
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;

    if (!(await hasMembershipAccess(user.id))) {
      return err("An active membership is required to book. Visit Membership to join.");
    }
    // Worker safety: customers book only after staff verifies their ID.
    if (user.role === "customer" && !(await isCustomerVerified(user.id))) {
      return err(
        "Your identity must be verified before you can book. Check your verification status on your dashboard."
      );
    }

    const start = parseBookingStart(data.date, data.startTime);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return err("Pick a date and time in the future.");
    }

    const [worker] = await db
      .select()
      .from(workers)
      .where(
        and(
          eq(workers.id, data.workerId),
          eq(workers.active, true),
          eq(workers.suspended, false)
        )
      );
    if (!worker) return err("This worker is not currently accepting bookings.");
    if (worker.userId === user.id) return err("You cannot book yourself.");

    const [service] = await db
      .select({
        ws: workerServices,
        typeName: serviceTypes.name,
      })
      .from(workerServices)
      .innerJoin(serviceTypes, eq(workerServices.serviceTypeId, serviceTypes.id))
      .where(
        and(
          eq(workerServices.workerId, worker.id),
          eq(workerServices.serviceTypeId, data.serviceTypeId),
          eq(workerServices.enabled, true)
        )
      );
    if (!service) return err("That service is not offered by this worker.");

    // Standard durations plus the worker's own duration for this service.
    const durationAllowed =
      BOOKING_DURATIONS_MINUTES.some((d) => d === data.durationMinutes) ||
      data.durationMinutes === service.ws.durationMinutes;
    if (!durationAllowed) return err("Invalid duration.");

    let addonRows: { name: string; priceCents: number }[] = [];
    if (data.addonIds.length > 0) {
      addonRows = await db
        .select({ name: serviceAddons.name, priceCents: serviceAddons.priceCents })
        .from(serviceAddons)
        .where(
          and(
            inArray(serviceAddons.id, data.addonIds),
            eq(serviceAddons.workerServiceId, service.ws.id)
          )
        );
      if (addonRows.length !== data.addonIds.length) {
        return err("One or more selected add-ons are unavailable.");
      }
    }

    const priceCents = service.ws.priceCents;
    const addonsCents = addonRows.reduce((sum, a) => sum + a.priceCents, 0);

    // Race-safe slot claim: the per-worker advisory lock serializes concurrent
    // submissions, so the availability/overlap re-check inside the lock is
    // authoritative — the loser of a same-slot race is rejected here.
    const result = await db.transaction(
      async (tx): Promise<{ conflict?: string; booking?: BookingRow }> => {
        await lockWorkerSchedule(tx, worker.id);
        const conflict = await slotConflictError(
          worker.id,
          data.date,
          data.startTime,
          data.durationMinutes
        );
        if (conflict) return { conflict };
        const [booking] = await tx
          .insert(bookings)
          .values({
            code: generateBookingCode(),
            customerId: user.id,
            workerId: worker.id,
            serviceTypeId: data.serviceTypeId,
            serviceName: service.typeName,
            date: data.date,
            startTime: data.startTime,
            durationMinutes: data.durationMinutes,
            address: data.address,
            lat: data.lat,
            lng: data.lng,
            instructions: data.instructions,
            priceCents,
            addonsCents,
            platformFeeCents: platformFeeCents(priceCents + addonsCents),
            addons: addonRows,
            safetyPin: generateSafetyPin(),
          })
          .returning();
        return { booking };
      }
    );
    if (result.conflict || !result.booking) {
      return err(result.conflict ?? ERR.server);
    }
    const booking = result.booking;

    await notifyBookingParties(booking, {
      type: "booking_submitted",
      customer: {
        title: `Booking ${booking.code} submitted`,
        body: `Your request with ${worker.stageName} on ${data.date} at ${data.startTime} is awaiting acceptance.`,
      },
      worker: {
        title: "New booking request",
        body: `New request for ${service.typeName} on ${data.date} at ${data.startTime}. Accept or decline in your dashboard.`,
      },
      admins: {
        title: `New booking ${booking.code}`,
        body: `${service.typeName} with ${worker.stageName} on ${data.date}.`,
      },
    });

    revalidatePath("/bookings");
    return ok({ bookingId: booking.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Accept / decline (worker or admin) ---------------------------------------

export async function acceptBooking(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = bookingDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadBookingFor(user, parsed.data.bookingId);
    if (!ctx) return err(ERR.notFound);
    if (!ctx.isWorker && !ctx.isAdmin) return err(ERR.forbidden);
    if (ctx.isWorker && !ctx.isAdmin && ctx.worker?.suspended) {
      return err(ERR.forbidden);
    }
    if (!canTransition(ctx.booking.status, "accepted", ctx.isAdmin)) {
      return err("This booking can no longer be accepted.");
    }

    await transitionBooking({
      booking: ctx.booking,
      to: "accepted",
      actorUserId: user.id,
      note: parsed.data.note,
    });
    if (ctx.isAdmin) {
      await writeAudit({
        actorUserId: user.id,
        action: "booking.accept",
        entity: "bookings",
        entityId: ctx.booking.id,
      });
    }

    await notifyBookingParties(ctx.booking, {
      type: "booking_accepted",
      customer: {
        title: `Booking ${ctx.booking.code} accepted — payment required`,
        body: "Your booking was accepted. Complete payment to confirm your reservation.",
      },
    });

    revalidatePath("/worker/bookings");
    revalidatePath("/bookings");
    revalidatePath("/admin/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function declineBooking(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = bookingDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadBookingFor(user, parsed.data.bookingId);
    if (!ctx) return err(ERR.notFound);
    if (!ctx.isWorker && !ctx.isAdmin) return err(ERR.forbidden);
    if (!canTransition(ctx.booking.status, "declined", ctx.isAdmin)) {
      return err("This booking can no longer be declined.");
    }

    await transitionBooking({
      booking: ctx.booking,
      to: "declined",
      actorUserId: user.id,
      note: parsed.data.note,
    });
    if (ctx.isAdmin) {
      await writeAudit({
        actorUserId: user.id,
        action: "booking.decline",
        entity: "bookings",
        entityId: ctx.booking.id,
      });
    }

    await notifyBookingParties(ctx.booking, {
      type: "booking_declined",
      customer: {
        title: `Booking ${ctx.booking.code} declined`,
        body: "Unfortunately this request was declined. Browse other available workers anytime.",
      },
    });

    revalidatePath("/worker/bookings");
    revalidatePath("/bookings");
    revalidatePath("/admin/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Cancel (customer ≥5h rule / worker / admin force) -------------------------

export async function cancelBooking(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = cancelBookingSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadBookingFor(user, parsed.data.bookingId);
    if (!ctx) return err(ERR.notFound);
    if (!ctx.isCustomer && !ctx.isWorker && !ctx.isAdmin) return err(ERR.forbidden);
    if (!canTransition(ctx.booking.status, "cancelled", ctx.isAdmin)) {
      return err("This booking can no longer be cancelled.");
    }
    if (ctx.isCustomer && !ctx.isAdmin && !customerCanCancel(ctx.booking)) {
      return err("Bookings can only be cancelled at least 5 hours before the start time.");
    }

    await db
      .update(bookings)
      .set({ cancellationReason: parsed.data.reason })
      .where(eq(bookings.id, ctx.booking.id));
    await transitionBooking({
      booking: ctx.booking,
      to: "cancelled",
      actorUserId: user.id,
      note: parsed.data.reason,
    });
    if (ctx.isAdmin && !ctx.isCustomer && !ctx.isWorker) {
      await writeAudit({
        actorUserId: user.id,
        action: "booking.force_cancel",
        entity: "bookings",
        entityId: ctx.booking.id,
        after: { reason: parsed.data.reason },
      });
    }

    // Auto-refund card payments; escalate cash/failures to admins.
    await refundBookingPayments(ctx.booking);

    await notifyBookingParties(ctx.booking, {
      type: "booking_cancelled",
      customer: {
        title: `Booking ${ctx.booking.code} cancelled`,
        body: "This booking has been cancelled. Card payments are refunded automatically; our team follows up on anything else.",
      },
      worker: {
        title: `Booking ${ctx.booking.code} cancelled`,
        body: "A booking on your schedule was cancelled.",
      },
    });

    revalidatePath("/worker/bookings");
    revalidatePath("/bookings");
    revalidatePath("/admin/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Reschedule (either party while pending/accepted/confirmed) ----------------

export async function rescheduleBooking(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = rescheduleBookingSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const ctx = await loadBookingFor(user, parsed.data.bookingId);
    if (!ctx) return err(ERR.notFound);
    if (!ctx.isCustomer && !ctx.isWorker && !ctx.isAdmin) return err(ERR.forbidden);
    const reschedulable = ["pending", "accepted", "confirmed"];
    if (!ctx.isAdmin && !reschedulable.some((s) => s === ctx.booking.status)) {
      return err("This booking can no longer be rescheduled.");
    }
    // Customers get the same 5-hour window as cancellation — otherwise a
    // last-minute reschedule-then-cancel defeats the cancellation policy.
    if (ctx.isCustomer && !ctx.isAdmin && !customerCanCancel(ctx.booking)) {
      return err(
        "Bookings can only be rescheduled at least 5 hours before the start time."
      );
    }

    const start = parseBookingStart(parsed.data.date, parsed.data.startTime);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return err("Pick a date and time in the future.");
    }

    // Same race-safe slot claim as createBooking; the booking being moved is
    // excluded from its own conflict check.
    const conflictResult = await db.transaction(
      async (tx): Promise<string | null> => {
        await lockWorkerSchedule(tx, ctx.booking.workerId);
        const conflict = await slotConflictError(
          ctx.booking.workerId,
          parsed.data.date,
          parsed.data.startTime,
          ctx.booking.durationMinutes,
          ctx.booking.id
        );
        if (conflict) return conflict;
        await tx
          .update(bookings)
          .set({
            date: parsed.data.date,
            startTime: parsed.data.startTime,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, ctx.booking.id));
        return null;
      }
    );
    if (conflictResult) return err(conflictResult);
    // Reschedules keep their status but must appear in the event log.
    await db.insert(bookingEvents).values({
      bookingId: ctx.booking.id,
      fromStatus: ctx.booking.status,
      toStatus: ctx.booking.status,
      actorUserId: user.id,
      note: `rescheduled ${ctx.booking.date} ${ctx.booking.startTime.slice(0, 5)} → ${parsed.data.date} ${parsed.data.startTime}`,
    });
    publishBooking(ctx.booking.id, bookingEventNow("schedule"));

    await notifyBookingParties(ctx.booking, {
      type: "booking_rescheduled",
      customer: {
        title: `Booking ${ctx.booking.code} rescheduled`,
        body: `New time: ${parsed.data.date} at ${parsed.data.startTime}.`,
      },
      worker: {
        title: `Booking ${ctx.booking.code} rescheduled`,
        body: `New time: ${parsed.data.date} at ${parsed.data.startTime}.`,
      },
    });

    revalidatePath("/worker/bookings");
    revalidatePath("/bookings");
    revalidatePath("/admin/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Complete (worker or admin) ------------------------------------------------

export async function completeBooking(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = bookingDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadBookingFor(user, parsed.data.bookingId);
    if (!ctx) return err(ERR.notFound);
    if (!ctx.isWorker && !ctx.isAdmin) return err(ERR.forbidden);
    if (!canTransition(ctx.booking.status, "completed", ctx.isAdmin)) {
      return err(
        ctx.booking.status === "confirmed"
          ? "Start the session first — enter the customer's PIN in the booking room, then complete it."
          : "Only a session that has been started can be completed."
      );
    }
    // No closing a session before the money is in hand: cash must be recorded
    // (with proof) and card payments must have settled. Admin can override.
    if (!ctx.isAdmin) {
      const [paid] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.bookingId, ctx.booking.id),
            eq(payments.status, "succeeded")
          )
        );
      if (!paid) {
        return err(
          "No payment is recorded for this booking yet. Record the cash collection (with proof) before completing."
        );
      }
    }

    await transitionBooking({
      booking: ctx.booking,
      to: "completed",
      actorUserId: user.id,
      note: parsed.data.note,
    });

    await notifyBookingParties(ctx.booking, {
      type: "review_request",
      customer: {
        title: "How was your experience?",
        body: `Booking ${ctx.booking.code} is complete. Leave a review from your booking history.`,
      },
    });

    revalidatePath("/worker/bookings");
    revalidatePath("/bookings");
    revalidatePath("/admin/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Reassign (admin only) -----------------------------------------------------

export async function reassignBooking(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return err(ERR.forbidden);
    const parsed = reassignBookingSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadBookingFor(user, parsed.data.bookingId);
    if (!ctx) return err(ERR.notFound);

    const [newWorker] = await db
      .select()
      .from(workers)
      .where(eq(workers.id, parsed.data.newWorkerId));
    if (!newWorker) return err("Target worker not found.");

    await db
      .update(bookings)
      .set({ workerId: newWorker.id, updatedAt: new Date() })
      .where(eq(bookings.id, ctx.booking.id));
    // Reassignments keep their status but must appear in the room timeline.
    await db.insert(bookingEvents).values({
      bookingId: ctx.booking.id,
      fromStatus: ctx.booking.status,
      toStatus: ctx.booking.status,
      actorUserId: user.id,
      note: `reassigned to ${newWorker.stageName}`,
    });
    publishBooking(ctx.booking.id, bookingEventNow("status"));
    await writeAudit({
      actorUserId: user.id,
      action: "booking.reassign",
      entity: "bookings",
      entityId: ctx.booking.id,
      before: { workerId: ctx.booking.workerId },
      after: { workerId: newWorker.id, note: parsed.data.note },
    });

    await notify({
      userId: newWorker.userId,
      type: "booking_reassigned",
      title: "A booking was assigned to you",
      body: `Booking ${ctx.booking.code} on ${ctx.booking.date} was reassigned to you by the Cheers team.`,
    });
    await notifyBookingParties({ ...ctx.booking, workerId: newWorker.id }, {
      type: "booking_reassigned",
      customer: {
        title: `Booking ${ctx.booking.code} update`,
        body: `Your booking will now be handled by ${newWorker.stageName}.`,
      },
    });

    revalidatePath("/admin/bookings");
    revalidatePath("/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
