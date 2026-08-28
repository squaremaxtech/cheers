import Stripe from "stripe";
import { CURRENCY, membershipPriceCents, stripeConfigured } from "@/lib/constants";

// Stripe is the online-payments layer and it is OPTIONAL (cash-first
// Jamaica): every flow in the app works with no keys set, and the card /
// subscription surfaces only render once stripeConfigured() is true. When
// the owner's US entity + Stripe account land, setting STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET and NEXT_PUBLIC_* flips everything on — no deploy
// beyond env changes.
//
// Later Connect phase (documented in HANDOFF): recipient accounts for
// workers/drivers (workers.stripeAccountId / drivers.stripeAccountId),
// transfers on completion, Stripe Identity for verification, card-on-file
// fee billing for cash jobs.

export { stripeConfigured };

export function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeConfigured()) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  return client;
}

// --- Checkout sessions ---------------------------------------------------------

// One-time card payment for a booking. The pending payments row exists
// BEFORE this is called; the webhook promotes it when the session completes.
export async function createBookingCheckoutSession(opts: {
  amountCents: number;
  bookingCode: string;
  serviceName: string;
  paymentId: string;
  bookingId: string;
  customerEmail: string;
}): Promise<string | null> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: opts.amountCents,
          product_data: {
            name: `Cheers booking ${opts.bookingCode}`,
            description: opts.serviceName,
          },
        },
      },
    ],
    metadata: {
      kind: "booking",
      paymentId: opts.paymentId,
      bookingId: opts.bookingId,
    },
    payment_intent_data: {
      metadata: {
        kind: "booking",
        paymentId: opts.paymentId,
        bookingId: opts.bookingId,
      },
    },
    success_url: appUrl(`/bookings/${opts.bookingId}?paid=1`),
    cancel_url: appUrl(`/bookings/${opts.bookingId}?cancelled=1`),
  });
  return session.url;
}

// The monthly Cheers Membership subscription. Status and period are
// webhook-driven from then on (invoice.paid / customer.subscription.*).
export async function createMembershipCheckoutSession(opts: {
  userId: string;
  customerEmail: string;
  returnPath: string;
}): Promise<string | null> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: opts.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: membershipPriceCents(),
          recurring: { interval: "month" },
          product_data: {
            name: "Cheers Membership",
            description: "Message and book professionals on Cheers",
          },
        },
      },
    ],
    metadata: { kind: "membership", userId: opts.userId },
    subscription_data: { metadata: { userId: opts.userId } },
    success_url: appUrl(`${opts.returnPath}?success=1`),
    cancel_url: appUrl(`${opts.returnPath}?cancelled=1`),
  });
  return session.url;
}

// --- Refunds --------------------------------------------------------------------

// Refund a settled PaymentIntent (full or partial). Returns false rather
// than throwing — callers escalate to admins on failure.
export async function refundStripePayment(
  paymentIntentId: string,
  amountCents?: number
): Promise<boolean> {
  try {
    const stripe = getStripe();
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amountCents ? { amount: amountCents } : {}),
    });
    return true;
  } catch (error) {
    console.error(
      "stripe refund failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

// --- Webhook --------------------------------------------------------------------

export function constructWebhookEvent(
  payload: string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET missing");
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

// The userId a subscription belongs to — from the metadata we stamp at
// checkout. Fetched fresh so the webhook never trusts a stale copy.
export async function subscriptionUserId(
  subscriptionId: string
): Promise<{ userId: string | null; subscription: Stripe.Subscription }> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  return { userId: subscription.metadata?.userId ?? null, subscription };
}

// The subscription's paid-through moment. The field moved from the
// subscription to its items across Stripe API versions — read both shapes.
export function subscriptionPeriodEnd(
  subscription: Stripe.Subscription
): Date | null {
  const item = subscription.items?.data?.[0] as
    | { current_period_end?: number }
    | undefined;
  const legacy = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  const end = item?.current_period_end ?? legacy;
  return end ? new Date(end * 1000) : null;
}

// The subscription an invoice bills, across API shapes (top-level field in
// older versions, parent.subscription_details in newer ones).
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } })
    .subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } };
    }
  ).parent;
  const nested = parent?.subscription_details?.subscription;
  if (typeof nested === "string") return nested;
  if (nested && typeof nested === "object") return nested.id;
  return null;
}
