import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  membershipPayments,
  memberships,
  payments,
  workers,
} from "@/db/schema";
import { transitionBooking } from "@/lib/bookings";
import { chatPassPriceCents, stripeConfigured } from "@/lib/constants";
import { notify, notifyAdmins } from "@/lib/notify";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import {
  constructWebhookEvent,
  invoiceSubscriptionId,
  refundStripePayment,
  subscriptionPeriodEnd,
  subscriptionUserId,
} from "@/lib/stripe";

// Stripe's server-to-server webhook — the ONLY thing that promotes online
// payments. Signature-verified; every promotion is a CAS on status='pending'
// so redeliveries and races are no-ops. (This replaces the old PowerTranz
// browser-callback flow: no iframe breakouts, no in-memory redirect maps.)

export async function POST(req: Request): Promise<Response> {
  if (!stripeConfigured()) return new Response("not configured", { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(await req.text(), signature);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.kind === "booking") {
          await fulfillBookingPayment(
            session.metadata.paymentId ?? "",
            session.metadata.bookingId ?? "",
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null
          );
        } else if (session.metadata?.kind === "chat_pass") {
          await linkChatPassSubscription(session);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object;
        if (session.metadata?.kind === "booking" && session.metadata.paymentId) {
          // The customer abandoned checkout — void the pending expectation.
          await db
            .update(payments)
            .set({ status: "failed", updatedAt: new Date() })
            .where(
              and(
                eq(payments.id, session.metadata.paymentId),
                eq(payments.status, "pending")
              )
            );
        }
        break;
      }
      case "invoice.paid":
        await fulfillChatPassInvoice(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncChatPassStatus(event.data.object);
        break;
      case "charge.refunded": {
        const charge = event.data.object;
        const intentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (intentId) {
          await db
            .update(payments)
            .set({ status: "refunded", updatedAt: new Date() })
            .where(
              and(
                eq(payments.gatewayTransactionId, intentId),
                eq(payments.status, "succeeded")
              )
            );
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(
      "stripe webhook failed:",
      error instanceof Error ? error.message : error
    );
    // 500 asks Stripe to redeliver — every handler above is idempotent.
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok");
}

// --- Booking card payment fulfillment (ported intact from the old gateway) ---

async function fulfillBookingPayment(
  paymentId: string,
  bookingId: string,
  transactionId: string | null
): Promise<void> {
  if (!paymentId || !bookingId) return;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));
  // Idempotency: only a pending payment may be promoted — a redelivered
  // event (or one racing another route) is a no-op.
  if (!payment || payment.status !== "pending") return;

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (!booking) return;

  // A confirmed booking can still be paying by card (cash → card switch),
  // as long as nothing else already collected the money.
  const cardAfterConfirm =
    booking.status === "confirmed" &&
    !(await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(eq(payments.bookingId, booking.id), eq(payments.status, "succeeded"))
      )
      .then((rows) => rows.length > 0));

  // Conflict: the booking left "accepted" (cancelled/declined/completed or
  // paid via another route) while checkout was open. The money was captured —
  // refund it immediately instead of pretending it confirmed.
  if (booking.status !== "accepted" && !cardAfterConfirm) {
    await db
      .update(payments)
      .set({
        status: "refunded",
        gatewayTransactionId: transactionId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
    const refunded = transactionId
      ? await refundStripePayment(transactionId, payment.amountCents)
      : false;
    if (!refunded) {
      await notifyAdmins({
        type: "refund_required",
        title: `Manual refund required — ${booking.code}`,
        body: "A card payment completed for a booking that is no longer awaiting payment, and the automatic refund failed. Refund it from the Stripe dashboard.",
        meta: { bookingId: booking.id, paymentId },
      });
    }
    await notify({
      userId: booking.customerId,
      type: "payment_refunded",
      title: `Payment refunded — ${booking.code}`,
      body: "This booking changed before your payment completed, so we refunded it automatically. Nothing further is needed.",
    });
    return;
  }

  await db
    .update(payments)
    .set({
      status: "succeeded",
      gatewayTransactionId: transactionId,
      updatedAt: new Date(),
    })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")));

  await db
    .update(bookings)
    .set({ tipCents: payment.tipCents, updatedAt: new Date() })
    .where(eq(bookings.id, booking.id));

  if (cardAfterConfirm) {
    // Already confirmed (cash → card switch): retire the now-obsolete cash
    // expectation and surface the payment change in the live room.
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(payments.bookingId, booking.id),
          eq(payments.method, "cash"),
          eq(payments.status, "pending")
        )
      );
    publishBooking(booking.id, bookingEventNow("payment"));
  } else {
    try {
      await transitionBooking({
        booking,
        to: "confirmed",
        actorUserId: null,
        note: "card payment succeeded",
      });
    } catch {
      // Lost a race with a concurrent transition; the pending-only guard
      // already recorded the money, so leave the status alone.
      return;
    }
  }

  await notify({
    userId: booking.customerId,
    type: "payment_received",
    title: `Booking ${booking.code} confirmed`,
    body: "Payment received — your booking is confirmed. See your dashboard for details.",
  });
  const [worker] = await db
    .select({ userId: workers.userId })
    .from(workers)
    .where(eq(workers.id, booking.workerId));
  if (worker) {
    await notify({
      userId: worker.userId,
      type: "payment_received",
      title: `Booking ${booking.code} is confirmed`,
      body: `The customer has paid. ${booking.date} at ${booking.startTime}.`,
    });
  }
  await notifyAdmins({
    type: "payment_received",
    title: `Payment received — ${booking.code}`,
    body: "A card payment succeeded via Stripe.",
  });
}

// --- Chat Pass subscription fulfillment ---------------------------------------

// checkout.session.completed (mode=subscription): link the Stripe ids to the
// membership row immediately; invoice.paid does the period bookkeeping.
async function linkChatPassSubscription(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) return;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  await db
    .insert(memberships)
    .values({
      userId,
      status: "active",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    })
    .onConflictDoUpdate({
      target: memberships.userId,
      set: {
        status: "active",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      },
    });
}

// invoice.paid: first charge AND every renewal. Sets the paid-through date
// and writes the receipt row. Idempotent on the invoice id.
async function fulfillChatPassInvoice(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const { userId, subscription } = await subscriptionUserId(subscriptionId);
  if (!userId) return;

  const periodEnd =
    subscriptionPeriodEnd(subscription) ??
    new Date(Date.now() + 30 * 86_400_000);
  const invoiceId = invoice.id ?? null;

  // Receipt trail — one row per invoice, keyed on the invoice id.
  if (invoiceId) {
    const [existing] = await db
      .select({ id: membershipPayments.id })
      .from(membershipPayments)
      .where(eq(membershipPayments.gatewayTransactionId, invoiceId));
    if (!existing) {
      await db.insert(membershipPayments).values({
        userId,
        amountCents: invoice.amount_paid ?? chatPassPriceCents(),
        status: "succeeded",
        gatewayTransactionId: invoiceId,
        periodStart: new Date(),
        periodEnd,
      });
    }
  }

  await db
    .insert(memberships)
    .values({
      userId,
      status: "active",
      currentPeriodEnd: periodEnd,
      stripeSubscriptionId: subscriptionId,
    })
    .onConflictDoUpdate({
      target: memberships.userId,
      set: {
        status: "active",
        currentPeriodEnd: periodEnd,
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      },
    });

  await notify({
    userId,
    type: "membership_active",
    title: "Your Chat Pass is active",
    body: `Payment received — your Chat Pass runs until ${periodEnd.toDateString()} and renews automatically.`,
  });
}

// Status sync: past_due, canceled, resumed — Stripe is the source of truth.
async function syncChatPassStatus(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId =
    subscription.metadata?.userId ??
    (await subscriptionUserId(subscription.id)).userId;
  if (!userId) return;

  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? "active"
      : subscription.status === "past_due" || subscription.status === "unpaid"
        ? "past_due"
        : "canceled";
  const periodEnd = subscriptionPeriodEnd(subscription);

  await db
    .update(memberships)
    .set({
      status,
      ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      updatedAt: new Date(),
    })
    .where(eq(memberships.stripeSubscriptionId, subscription.id));
}
