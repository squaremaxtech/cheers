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
import { MEMBERSHIP_PERIOD_DAYS } from "@/lib/constants";
import { notify, notifyAdmins } from "@/lib/notify";
import {
  completeGatewayPayment,
  gatewaySimulated,
  refundGatewayPayment,
} from "@/lib/powertranz";
import { bookingEventNow, publishBooking } from "@/lib/realtime";

// PowerTranz MerchantResponseUrl target. After the hosted page + 3DS, the
// gateway posts the outcome here (from the customer's browser), carrying the
// SpiToken. We finalize SERVER-SIDE with /api/spi/payment — the gateway's
// answer, never this request body, decides approval — then bounce the
// customer's browser back into the app. The route is necessarily
// unauthenticated: a forged post without a completable SpiToken changes
// nothing (payments only ever flip pending → succeeded via the gateway).

type GatewayOutcome = {
  approved: boolean;
  transactionId: string | null;
  message: string;
};

// The gateway may post JSON (documented default) or a form body.
async function extractCallback(req: Request): Promise<{
  spiToken: string | null;
  simApproved: boolean;
}> {
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const data: { SpiToken?: string; SimApproved?: string } =
        await req.json();
      return {
        spiToken: data.SpiToken ?? null,
        simApproved: data.SimApproved === "1",
      };
    }
    const form = await req.formData();
    const spiToken = form.get("SpiToken");
    return {
      spiToken: typeof spiToken === "string" ? spiToken : null,
      simApproved: form.get("SimApproved") === "1",
    };
  } catch {
    return { spiToken: null, simApproved: false };
  }
}

// The gateway's post may arrive inside the 3DS iframe — plain HTTP redirects
// would navigate the frame, not the page, so break out with script.
function redirectResponse(target: string): Response {
  return new Response(
    `<!doctype html><html><body>
<script>window.top.location.replace(${JSON.stringify(target)});</script>
<noscript><a href="${target}">Continue</a></noscript>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

async function resolveOutcome(
  spiToken: string,
  simApproved: boolean
): Promise<GatewayOutcome> {
  if (gatewaySimulated() && spiToken.startsWith("SIM-")) {
    return {
      approved: simApproved,
      transactionId: spiToken,
      message: simApproved ? "simulated approval" : "simulated decline",
    };
  }
  return completeGatewayPayment(spiToken);
}

// --- Booking card payment fulfillment (ported from the old Stripe webhook) ---

async function fulfillBookingPayment(
  paymentId: string,
  bookingId: string,
  outcome: GatewayOutcome
): Promise<string> {
  const target = `/bookings/${bookingId}`;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));
  // Idempotency: only a pending payment may be promoted — a replayed
  // callback (or one racing another route) is a no-op.
  if (!payment || payment.status !== "pending") return target;

  if (!outcome.approved) {
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")));
    return `${target}?cancelled=1`;
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (!booking) return target;

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
  // paid via another route) while the hosted page was open. The money was
  // captured — refund it immediately instead of pretending it confirmed.
  if (booking.status !== "accepted" && !cardAfterConfirm) {
    await db
      .update(payments)
      .set({
        status: "refunded",
        gatewayTransactionId: outcome.transactionId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
    const refunded = outcome.transactionId
      ? await refundGatewayPayment(outcome.transactionId, payment.amountCents)
      : false;
    if (!refunded) {
      await notifyAdmins({
        type: "refund_required",
        title: `Manual refund required — ${booking.code}`,
        body: "A card payment completed for a booking that is no longer awaiting payment, and the automatic refund failed. Refund it from the PowerTranz portal.",
        meta: { bookingId: booking.id, paymentId },
      });
    }
    await notify({
      userId: booking.customerId,
      type: "payment_refunded",
      title: `Payment refunded — ${booking.code}`,
      body: "This booking changed before your payment completed, so we refunded it automatically. Nothing further is needed.",
    });
    return `${target}?cancelled=1`;
  }

  await db
    .update(payments)
    .set({
      status: "succeeded",
      gatewayTransactionId: outcome.transactionId,
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
      return `${target}?paid=1`;
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
    body: "A card payment succeeded via PowerTranz.",
  });
  return `${target}?paid=1`;
}

// --- Membership payment fulfillment ------------------------------------------

async function fulfillMembershipPayment(
  membershipPaymentId: string,
  returnPath: string,
  outcome: GatewayOutcome
): Promise<string> {
  const [row] = await db
    .select()
    .from(membershipPayments)
    .where(eq(membershipPayments.id, membershipPaymentId));
  if (!row || row.status !== "pending") return `${returnPath}?success=1`;

  if (!outcome.approved) {
    await db
      .update(membershipPayments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(membershipPayments.id, row.id),
          eq(membershipPayments.status, "pending")
        )
      );
    return `${returnPath}?cancelled=1`;
  }

  // Extend from whatever is left ("further payments pushed back") — renewing
  // early never loses days.
  const [existing] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, row.userId));
  const now = new Date();
  const base =
    existing?.currentPeriodEnd && existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now;
  const periodEnd = new Date(
    base.getTime() + MEMBERSHIP_PERIOD_DAYS * 86_400_000
  );

  const promoted = await db
    .update(membershipPayments)
    .set({
      status: "succeeded",
      gatewayTransactionId: outcome.transactionId,
      periodStart: base,
      periodEnd,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(membershipPayments.id, row.id),
        eq(membershipPayments.status, "pending")
      )
    )
    .returning({ id: membershipPayments.id });
  if (promoted.length === 0) return `${returnPath}?success=1`; // replay race

  await db
    .insert(memberships)
    .values({ userId: row.userId, status: "active", currentPeriodEnd: periodEnd })
    .onConflictDoUpdate({
      target: memberships.userId,
      set: {
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    });

  await notify({
    userId: row.userId,
    type: "membership_active",
    title: "Your membership is active",
    body: `Payment received — your membership now runs until ${periodEnd.toDateString()}. Renewing later adds on top, so you never lose days.`,
  });
  return `${returnPath}?success=1`;
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const { spiToken, simApproved } = await extractCallback(req);

  try {
    if (kind === "booking") {
      const paymentId = url.searchParams.get("payment");
      const bookingId = url.searchParams.get("booking");
      if (!paymentId || !bookingId || !spiToken) {
        return redirectResponse("/bookings");
      }
      const outcome = await resolveOutcome(spiToken, simApproved);
      const target = await fulfillBookingPayment(paymentId, bookingId, outcome);
      return redirectResponse(target);
    }

    if (kind === "membership") {
      const membershipPaymentId = url.searchParams.get("mp");
      const returnPath =
        url.searchParams.get("return") === "welcome" ? "/welcome" : "/membership";
      if (!membershipPaymentId || !spiToken) {
        return redirectResponse(returnPath);
      }
      const outcome = await resolveOutcome(spiToken, simApproved);
      const target = await fulfillMembershipPayment(
        membershipPaymentId,
        returnPath,
        outcome
      );
      return redirectResponse(target);
    }
  } catch (error) {
    console.error(
      "pay callback failed:",
      error instanceof Error ? error.message : error
    );
    return redirectResponse("/dashboard");
  }
  return redirectResponse("/dashboard");
}
