import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, memberships, payments, workers } from "@/db/schema";
import { transitionBooking } from "@/lib/bookings";
import { notify, notifyAdmins } from "@/lib/notify";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import { stripe } from "@/lib/stripe";
import type { MembershipRow } from "@/types";

async function handleBookingPaid(session: Stripe.Checkout.Session): Promise<void> {
  const paymentId = session.metadata?.paymentId;
  const bookingId = session.metadata?.bookingId;
  if (!paymentId || !bookingId) return;

  // Async payment methods complete the session before funds settle — only
  // treat fully-paid sessions as money in hand.
  if (session.payment_status !== "paid") return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));
  // Idempotency: only a pending payment may be promoted. Redelivered events
  // must never flip a refunded/failed payment back to succeeded.
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
        and(
          eq(payments.bookingId, booking.id),
          eq(payments.status, "succeeded")
        )
      )
      .then((rows) => rows.length > 0));

  // Conflict: the booking left "accepted" (cancelled/declined/completed or
  // paid via another route) while this checkout session was open. The money
  // was captured — refund it immediately instead of pretending it confirmed.
  if (booking.status !== "accepted" && !cardAfterConfirm) {
    await db
      .update(payments)
      .set({
        status: "refunded",
        stripePaymentIntentId: paymentIntentId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
    if (paymentIntentId) {
      try {
        await stripe().refunds.create({ payment_intent: paymentIntentId });
      } catch (error) {
        console.error(
          "conflict auto-refund failed:",
          error instanceof Error ? error.message : error
        );
        await notifyAdmins({
          type: "refund_required",
          title: `Manual refund required — ${booking.code}`,
          body: "A card payment completed for a booking that is no longer awaiting payment, and the automatic refund failed. Refund it from Stripe.",
          meta: { bookingId: booking.id, paymentId },
        });
      }
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
      stripePaymentIntentId: paymentIntentId,
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
      // Lost a race with a concurrent transition; Stripe will redeliver and
      // the pending-only guard makes the retry a no-op. Status stays
      // consistent.
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

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const end = sub.items.data[0]?.current_period_end;
  return typeof end === "number" ? new Date(end * 1000) : null;
}

function membershipStatusFrom(sub: Stripe.Subscription): MembershipRow["status"] {
  if (sub.status === "active" || sub.status === "trialing") return "active";
  if (sub.status === "past_due" || sub.status === "unpaid") return "past_due";
  return "canceled";
}

async function handleMembershipCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  let periodEnd: Date | null = null;
  if (subscriptionId) {
    const sub = await stripe().subscriptions.retrieve(subscriptionId);
    periodEnd = subscriptionPeriodEnd(sub);
  }

  // Upsert on the unique userId index — concurrent webhook deliveries can't
  // race a select-then-insert into a duplicate.
  await db
    .insert(memberships)
    .values({
      userId,
      status: "active",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: memberships.userId,
      set: {
        status: "active",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    });

  await notify({
    userId,
    type: "membership_active",
    title: "Welcome to Cheers",
    body: "Your membership is active. Enjoy full access to browsing and bookings.",
  });
}

async function handleSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.stripeSubscriptionId, sub.id));

  if (membership) {
    await db
      .update(memberships)
      .set({
        status: membershipStatusFrom(sub),
        currentPeriodEnd: subscriptionPeriodEnd(sub),
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, membership.id));
    return;
  }

  // subscription.updated can arrive before checkout.session.completed —
  // fall back to the userId we stamped on the subscription's metadata.
  const userId = sub.metadata?.userId;
  if (!userId) return;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await db
    .insert(memberships)
    .values({
      userId,
      status: membershipStatusFrom(sub),
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
    })
    .onConflictDoUpdate({
      target: memberships.userId,
      set: {
        status: membershipStatusFrom(sub),
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: subscriptionPeriodEnd(sub),
        updatedAt: new Date(),
      },
    });
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return Response.json({ error: "webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.error(
      "stripe webhook signature verification failed:",
      error instanceof Error ? error.message : error
    );
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.kind === "booking") {
          await handleBookingPaid(session);
        } else if (session.metadata?.kind === "membership") {
          await handleMembershipCheckout(session);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(
      "stripe webhook handler failed:",
      error instanceof Error ? error.message : error
    );
    return Response.json({ error: "handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
