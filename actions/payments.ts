"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings, payments, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { transitionBooking } from "@/lib/bookings";
import { guardErrorMessage, requireAdmin, requireUser, requireWorker } from "@/lib/guards";
import { notify, notifyAdmins } from "@/lib/notify";
import {
  appUrl,
  gatewayConfigured,
  initiateHostedPayment,
  refundGatewayPayment,
  storeRedirectPage,
} from "@/lib/powertranz";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import {
  adminPaymentStatusSchema,
  cashCollectedSchema,
  checkoutSchema,
  chooseCashSchema,
  refundSchema,
} from "@/schemas/payment";
import type { ActionResult, BookingRow } from "@/types";

async function hasSucceededPayment(bookingId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(eq(payments.bookingId, bookingId), eq(payments.status, "succeeded"))
    );
  return Boolean(row);
}

function serviceTotalCents(booking: BookingRow): number {
  return booking.priceCents + booking.addonsCents;
}

// --- Card payment via the PowerTranz hosted page (customer, after acceptance) --

export async function createBookingCheckout(
  input: unknown
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    if (!gatewayConfigured()) {
      return err(
        "Card payments are not set up yet — choose cash at the meeting instead."
      );
    }

    const [booking] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, parsed.data.bookingId),
          eq(bookings.customerId, user.id)
        )
      );
    if (!booking) return err(ERR.notFound);
    // Two ways in: paying an accepted booking, or switching a confirmed
    // cash-at-meeting booking to card any time before the session starts.
    // Once the session is in progress (or cash was collected) the method is
    // locked — disputes go through admin refunds instead.
    if (booking.status !== "accepted" && booking.status !== "confirmed") {
      return err("This booking is not awaiting payment.");
    }
    if (await hasSucceededPayment(booking.id)) {
      return err("This booking is already paid.");
    }

    // Invalidate any earlier attempts so only one live payment path exists.
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(eq(payments.bookingId, booking.id), eq(payments.status, "pending"))
      );

    const tipCents = parsed.data.tipCents;
    const serviceTotal = serviceTotalCents(booking);

    // Pending payment row first so the webhook has something to confirm.
    const [payment] = await db
      .insert(payments)
      .values({
        bookingId: booking.id,
        customerId: user.id,
        amountCents: serviceTotal + tipCents,
        tipCents,
        platformFeeCents: booking.platformFeeCents,
        method: "card",
        status: "pending",
      })
      .returning({ id: payments.id });

    // PowerTranz hosted page: the customer enters their card on the
    // gateway's page (card data never touches this app), completes 3DS, and
    // the gateway posts the outcome to /api/pay/callback which finalizes.
    const init = await initiateHostedPayment({
      amountCents: serviceTotal + tipCents,
      orderId: booking.code,
      responseUrl: appUrl(
        `/api/pay/callback?kind=booking&payment=${payment.id}&booking=${booking.id}`
      ),
    });
    const token = storeRedirectPage(init.redirectData);
    return ok({ url: appUrl(`/api/pay/session/${token}`) });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Cash at meeting (customer commits, worker confirms collection) -----------

export async function chooseCashPayment(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = chooseCashSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [booking] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, parsed.data.bookingId),
          eq(bookings.customerId, user.id)
        )
      );
    if (!booking) return err(ERR.notFound);
    if (booking.status !== "accepted") {
      return err("This booking is not awaiting payment.");
    }
    if (await hasSucceededPayment(booking.id)) {
      return err("This booking is already paid.");
    }

    const tipCents = parsed.data.tipCents;

    // Replace any earlier attempt with the cash expectation.
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(eq(payments.bookingId, booking.id), eq(payments.status, "pending"))
      );
    await db.insert(payments).values({
      bookingId: booking.id,
      customerId: user.id,
      amountCents: serviceTotalCents(booking) + tipCents,
      tipCents,
      platformFeeCents: booking.platformFeeCents,
      method: "cash",
      status: "pending",
    });

    await db
      .update(bookings)
      .set({ tipCents, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    await transitionBooking({
      booking,
      to: "confirmed",
      actorUserId: user.id,
      note: "customer chose cash at meeting",
    });

    const total = serviceTotalCents(booking) + tipCents;
    await notify({
      userId: booking.customerId,
      type: "booking_confirmed",
      title: `Booking ${booking.code} confirmed — cash at meeting`,
      body: `Please have the amount ready in cash at your booking. Your PIN is in the booking details.`,
    });
    const [worker] = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(eq(workers.id, booking.workerId));
    if (worker) {
      await notify({
        userId: worker.userId,
        type: "booking_confirmed",
        title: `Booking ${booking.code} confirmed — collect cash`,
        body: `The customer will pay cash at the meeting. Collect the full amount and record it with proof afterwards.`,
        meta: { bookingId: booking.id, amountCents: String(total) },
      });
    }

    revalidatePath("/bookings");
    revalidatePath("/worker/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Worker confirms cash was collected. Amount is server-derived from the
// booking; the worker supplies only the tip actually received plus proof.
export async function recordCashCollected(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { user, worker } = await requireWorker();
    const parsed = cashCollectedSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [booking] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, parsed.data.bookingId),
          eq(bookings.workerId, worker.id)
        )
      );
    if (!booking) return err(ERR.notFound);
    // Recording is allowed right through the session — workers often collect
    // at the door but only log it after starting with the PIN.
    if (
      booking.status !== "accepted" &&
      booking.status !== "confirmed" &&
      booking.status !== "in_progress"
    ) {
      return err(
        "Cash can only be recorded while a booking is accepted, confirmed or in progress."
      );
    }
    if (await hasSucceededPayment(booking.id)) {
      return err("A payment was already recorded for this booking.");
    }

    const tipCents = parsed.data.tipCents;
    const amountCents = serviceTotalCents(booking) + tipCents;

    // Reuse the customer's pending cash expectation if there is one.
    const [pendingCash] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, booking.id),
          eq(payments.method, "cash"),
          eq(payments.status, "pending")
        )
      );
    if (pendingCash) {
      await db
        .update(payments)
        .set({
          amountCents,
          tipCents,
          status: "succeeded",
          cashProofUrl: parsed.data.proofUrl,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, pendingCash.id));
    } else {
      await db.insert(payments).values({
        bookingId: booking.id,
        customerId: booking.customerId,
        amountCents,
        tipCents,
        platformFeeCents: booking.platformFeeCents,
        method: "cash",
        status: "succeeded",
        cashProofUrl: parsed.data.proofUrl,
      });
    }

    await db
      .update(bookings)
      .set({ tipCents, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    if (booking.status === "accepted") {
      await transitionBooking({
        booking,
        to: "confirmed",
        actorUserId: user.id,
        note: "cash collected",
      });
    } else {
      // No status change — push the payment update to the live room itself.
      publishBooking(booking.id, bookingEventNow("payment"));
    }

    await notify({
      userId: booking.customerId,
      type: "payment_received",
      title: `Payment received for ${booking.code}`,
      body: "Your cash payment was recorded. Thank you!",
    });
    await notifyAdmins({
      type: "payment_received",
      title: `Cash collected — ${booking.code}`,
      body: "A worker recorded a cash collection with proof. Review it in the admin payments view.",
      meta: { bookingId: booking.id },
    });

    revalidatePath("/worker/bookings");
    revalidatePath("/admin/payments");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Admin: resolve a stuck pending payment --------------------------------------

// Cash expectations that never got recorded (worker forgot proof, dispute
// settled off-platform, …) sit pending forever without this. Admin can mark
// them collected or void them; both are audited.
export async function adminResolvePendingPayment(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = adminPaymentStatusSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, parsed.data.paymentId));
    if (!payment) return err(ERR.notFound);
    if (payment.status !== "pending") {
      return err("Only pending payments can be resolved this way.");
    }

    // CAS: a webhook or worker recording landing at the same moment wins.
    const updated = await db
      .update(payments)
      .set({ status: parsed.data.to, updatedAt: new Date() })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
      .returning({ id: payments.id });
    if (updated.length === 0) {
      return err("This payment just changed state — reload and check again.");
    }

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId));

    // Marking a cash payment collected confirms the booking the same way a
    // worker recording it would.
    if (parsed.data.to === "succeeded" && booking?.status === "accepted") {
      await transitionBooking({
        booking,
        to: "confirmed",
        actorUserId: admin.id,
        note: "payment marked collected by admin",
      });
    } else if (booking) {
      publishBooking(booking.id, bookingEventNow("payment"));
    }

    await writeAudit({
      actorUserId: admin.id,
      action: `payment.${parsed.data.to === "succeeded" ? "mark_collected" : "void"}`,
      entity: "payments",
      entityId: payment.id,
      before: { status: "pending" },
      after: { status: parsed.data.to, note: parsed.data.note },
    });
    if (parsed.data.to === "succeeded") {
      await notify({
        userId: payment.customerId,
        type: "payment_received",
        title: `Payment recorded for ${booking?.code ?? "your booking"}`,
        body: "Our team confirmed your payment. Thank you!",
        meta: booking ? { bookingId: booking.id } : undefined,
      });
    }

    revalidatePath("/admin/payments");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Refund (admin) -------------------------------------------------------------

export async function refundPayment(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = refundSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, parsed.data.paymentId));
    if (!payment) return err(ERR.notFound);
    if (payment.status !== "succeeded") return err("Only succeeded payments can be refunded.");

    if (payment.method === "card" && payment.gatewayTransactionId) {
      const refunded = await refundGatewayPayment(
        payment.gatewayTransactionId,
        payment.amountCents
      );
      if (!refunded) {
        return err(
          "The gateway declined the refund — process it from the PowerTranz portal, then mark it here."
        );
      }
    }

    // CAS so a concurrent webhook redelivery can't fight this write.
    await db
      .update(payments)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(
        and(eq(payments.id, payment.id), eq(payments.status, "succeeded"))
      );

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId));
    if (
      booking &&
      booking.status !== "refunded" &&
      booking.status !== "cancelled"
    ) {
      await transitionBooking({
        booking,
        to: "refunded",
        actorUserId: admin.id,
        note: parsed.data.note ?? "refund issued",
      });
    } else if (booking) {
      // Already terminal — still surface the payment change in the room.
      publishBooking(booking.id, bookingEventNow("payment"));
    }

    await writeAudit({
      actorUserId: admin.id,
      action: "payment.refund",
      entity: "payments",
      entityId: payment.id,
      after: { note: parsed.data.note },
    });
    await notify({
      userId: payment.customerId,
      type: "payment_refunded",
      title: "Your payment was refunded",
      body: `A refund was issued for booking ${booking?.code ?? ""}. Card refunds take 5-10 business days; cash refunds are arranged by our team.`,
    });

    revalidatePath("/admin/payments");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
