"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings, payments, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { transitionBooking } from "@/lib/bookings";
import { CURRENCY } from "@/lib/constants";
import { guardErrorMessage, requireAdmin, requireUser, requireWorker } from "@/lib/guards";
import { notify, notifyAdmins } from "@/lib/notify";
import { appUrl, stripe } from "@/lib/stripe";
import { cashPaymentSchema, checkoutSchema, refundSchema } from "@/schemas/payment";
import type { ActionResult } from "@/types";

// --- Card payment via Stripe Checkout (customer, after acceptance) ------------

export async function createBookingCheckout(
  input: unknown
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    const parsed = checkoutSchema.safeParse(input);
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

    const tipCents = parsed.data.tipCents;
    const serviceTotal = booking.priceCents + booking.addonsCents;

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

    const lineItems = [
      {
        price_data: {
          currency: CURRENCY,
          product_data: { name: `${booking.serviceName} — booking ${booking.code}` },
          unit_amount: serviceTotal,
        },
        quantity: 1,
      },
    ];
    if (tipCents > 0) {
      lineItems.push({
        price_data: {
          currency: CURRENCY,
          product_data: { name: "Tip (100% to your worker)" },
          unit_amount: tipCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: lineItems,
      metadata: {
        kind: "booking",
        bookingId: booking.id,
        paymentId: payment.id,
        tipCents: String(tipCents),
      },
      success_url: appUrl(`/bookings/${booking.id}?paid=1`),
      cancel_url: appUrl(`/bookings/${booking.id}?cancelled=1`),
    });

    if (!session.url) return err(ERR.server);
    return ok({ url: session.url });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Cash payment (worker records collection + uploads proof) ------------------

export async function recordCashPayment(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { user, worker } = await requireWorker();
    const parsed = cashPaymentSchema.safeParse(input);
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
    if (booking.status !== "accepted" && booking.status !== "confirmed") {
      return err("Cash can only be recorded for accepted or confirmed bookings.");
    }

    await db.insert(payments).values({
      bookingId: booking.id,
      customerId: booking.customerId,
      amountCents: parsed.data.amountCents,
      tipCents: parsed.data.tipCents,
      platformFeeCents: booking.platformFeeCents,
      method: "cash",
      status: "succeeded",
      cashProofUrl: parsed.data.proofUrl,
    });

    if (parsed.data.tipCents > 0 || booking.tipCents === 0) {
      await db
        .update(bookings)
        .set({ tipCents: parsed.data.tipCents, updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));
    }
    if (booking.status === "accepted") {
      await transitionBooking({
        booking,
        to: "confirmed",
        actorUserId: user.id,
        note: "cash payment recorded",
      });
    }

    await notify({
      userId: booking.customerId,
      type: "payment_received",
      title: `Payment received for ${booking.code}`,
      body: "Your cash payment was recorded. Your booking is confirmed.",
    });
    await notifyAdmins({
      type: "payment_received",
      title: `Cash payment recorded — ${booking.code}`,
      body: `Worker recorded a cash payment with proof. Review it in the admin payments view.`,
    });

    revalidatePath("/worker/bookings");
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

    if (payment.method === "card" && payment.stripePaymentIntentId) {
      await stripe().refunds.create({
        payment_intent: payment.stripePaymentIntentId,
      });
    }

    await db
      .update(payments)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId));
    if (booking && booking.status !== "refunded") {
      await transitionBooking({
        booking,
        to: "refunded",
        actorUserId: admin.id,
        note: parsed.data.note ?? "refund issued",
      });
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
      body: `A refund was issued for booking ${booking?.code ?? ""}. Card refunds take 5-10 business days.`,
    });

    revalidatePath("/admin/payments");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
