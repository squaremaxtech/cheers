"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings, feeInvoices, payments, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { chargeFeeInvoice, periodLabel } from "@/lib/billing";
import { transitionBooking } from "@/lib/bookings";
import { formatCents } from "@/lib/constants";
import {
  guardErrorMessage,
  requireAdmin,
  requireDeskStaff,
  requireUser,
  requireWorker,
} from "@/lib/guards";
import { notify, notifyAdmins } from "@/lib/notify";
import { jobPaymentMethodLabel } from "@/lib/payments/config";
import {
  paymentsConfigured,
  refundTransaction,
  startCardSetup,
} from "@/lib/payments/powertranz";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import {
  adminPaymentStatusSchema,
  cardSetupSchema,
  confirmDirectPaymentSchema,
  feeInvoiceSchema,
  markJobPaymentSentSchema,
  recordJobPaymentSchema,
  refundSchema,
} from "@/schemas/payment";
import type { ActionResult, BookingRow } from "@/types";

// =============================================================================
// JOB MONEY IS RECORDED, NEVER HELD.
// =============================================================================
//
// A customer pays their professional directly — cash, bank transfer, Lynk —
// and these actions record what happened. There is no card checkout for a
// booking, no platform balance, and no payout: taking a customer's money and
// passing it to a worker is money transmission, licensed by Bank of Jamaica
// and not something an ordinary local merchant account may do.
//
// The only card charges in this codebase are platform revenue: the customer's
// membership (actions/memberships.ts) and the professional's 5% commission
// (lib/billing.ts). Both live behind paymentsConfigured() and both are dark
// until a merchant account exists.

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

// Recording is allowed right through the session — professionals often collect
// at the door but only log it after starting with the PIN.
function payableStatus(status: BookingRow["status"]): boolean {
  return (
    status === "accepted" || status === "confirmed" || status === "in_progress"
  );
}

const NOT_PAYABLE =
  "A payment can only be recorded while a booking is accepted, confirmed or in progress.";

// --- Customer: confirm the booking, then pay the professional directly -------

// Accepted → confirmed. No money moves through CheersJA here or anywhere else:
// the customer is agreeing to the job and to paying the professional direct.
export async function confirmDirectPayment(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = confirmDirectPaymentSchema.safeParse(input);
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
      return err("This booking is not waiting to be confirmed.");
    }

    const tipCents = parsed.data.tipCents;
    await db
      .update(bookings)
      .set({ tipCents, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    await transitionBooking({
      booking,
      to: "confirmed",
      actorUserId: user.id,
      note: "customer confirmed — paying the professional directly",
    });

    const total = serviceTotalCents(booking) + tipCents;
    await notify({
      userId: booking.customerId,
      type: "booking_confirmed",
      title: `Booking ${booking.code} confirmed`,
      body: `You'll pay ${formatCents(total)} directly to your professional — their payment details are on the booking. Your PIN is there too.`,
      meta: { bookingId: booking.id },
    });
    const [worker] = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(eq(workers.id, booking.workerId));
    if (worker) {
      await notify({
        userId: worker.userId,
        type: "booking_confirmed",
        title: `Booking ${booking.code} confirmed`,
        body: `The customer will pay you ${formatCents(total)} directly. Record it on the booking once it's in hand.`,
        meta: { bookingId: booking.id },
      });
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${booking.id}`);
    revalidatePath("/worker/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// The customer says they have sent the money. This is a CLAIM, not the record:
// it nudges the professional, who confirms receipt. One pending claim per
// booking — re-submitting updates it rather than stacking rows.
export async function markJobPaymentSent(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = markJobPaymentSentSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

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
    if (!payableStatus(booking.status)) return err(NOT_PAYABLE);
    if (await hasSucceededPayment(booking.id)) {
      return err("This booking is already marked paid.");
    }

    const amountCents = serviceTotalCents(booking) + booking.tipCents;
    const [pending] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(eq(payments.bookingId, booking.id), eq(payments.status, "pending"))
      );
    if (pending) {
      await db
        .update(payments)
        .set({
          amountCents,
          method: parsed.data.method,
          cashProofUrl: parsed.data.note,
          updatedAt: new Date(),
        })
        .where(and(eq(payments.id, pending.id), eq(payments.status, "pending")));
    } else {
      await db.insert(payments).values({
        bookingId: booking.id,
        customerId: user.id,
        amountCents,
        tipCents: booking.tipCents,
        platformFeeCents: booking.platformFeeCents,
        method: parsed.data.method,
        status: "pending",
        cashProofUrl: parsed.data.note,
      });
    }

    const [worker] = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(eq(workers.id, booking.workerId));
    if (worker) {
      await notify({
        userId: worker.userId,
        type: "payment_claimed",
        title: `Customer says they've paid — ${booking.code}`,
        body: `${formatCents(amountCents)} by ${jobPaymentMethodLabel(
          parsed.data.method
        )}${parsed.data.note ? ` (${parsed.data.note})` : ""}. Confirm it on the booking once it's in hand.`,
        meta: { bookingId: booking.id },
      });
    }
    publishBooking(booking.id, bookingEventNow("payment"));

    revalidatePath(`/bookings/${booking.id}`);
    revalidatePath("/worker/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Professional: confirm the money is in hand ------------------------------

// THE record. The professional's confirmation is what the platform treats as
// true — there is no proof upload and no arbitration flow, because we never
// held the money and cannot adjudicate it. Disagreements are a support
// conversation, not a feature.
//
// The service amount is derived from the booking; only the tip is reported.
export async function recordJobPayment(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { user, worker } = await requireWorker();
    const parsed = recordJobPaymentSchema.safeParse(input);
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
    if (!payableStatus(booking.status)) return err(NOT_PAYABLE);
    if (await hasSucceededPayment(booking.id)) {
      return err("A payment was already recorded for this booking.");
    }

    const tipCents = parsed.data.tipCents;
    const amountCents = serviceTotalCents(booking) + tipCents;

    // Reuse the customer's pending claim if there is one, so a booking never
    // ends up with two rows for one payment.
    const [pending] = await db
      .select({ id: payments.id, note: payments.cashProofUrl })
      .from(payments)
      .where(
        and(eq(payments.bookingId, booking.id), eq(payments.status, "pending"))
      );
    if (pending) {
      const promoted = await db
        .update(payments)
        .set({
          amountCents,
          tipCents,
          method: parsed.data.method,
          status: "succeeded",
          cashProofUrl: parsed.data.note ?? pending.note,
          updatedAt: new Date(),
        })
        .where(and(eq(payments.id, pending.id), eq(payments.status, "pending")))
        .returning({ id: payments.id });
      if (promoted.length === 0) {
        return err("This payment just changed state — reload and check again.");
      }
    } else {
      await db.insert(payments).values({
        bookingId: booking.id,
        customerId: booking.customerId,
        amountCents,
        tipCents,
        platformFeeCents: booking.platformFeeCents,
        method: parsed.data.method,
        status: "succeeded",
        cashProofUrl: parsed.data.note,
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
        note: "payment received directly",
      });
    } else {
      // No status change — push the payment update to the live room itself.
      publishBooking(booking.id, bookingEventNow("payment"));
    }

    await notify({
      userId: booking.customerId,
      type: "payment_received",
      title: `Payment confirmed for ${booking.code}`,
      body: `${worker.stageName} confirmed receiving ${formatCents(
        amountCents
      )} by ${jobPaymentMethodLabel(parsed.data.method)}. Thank you!`,
      meta: { bookingId: booking.id },
    });

    revalidatePath("/worker/bookings");
    revalidatePath(`/bookings/${booking.id}`);
    revalidatePath("/admin/payments");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Card on file (platform revenue only) ------------------------------------

// Start storing a card with the gateway. The card is charged for exactly two
// things — a customer's membership and a professional's monthly commission —
// and never for a job. Returns a URL to send the browser to.
export async function beginCardSetup(
  input: unknown
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    const parsed = cardSetupSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    if (!paymentsConfigured()) {
      return err("Card payments are not set up yet — nothing to add just now.");
    }

    const started = await startCardSetup({
      userId: user.id,
      returnPath: parsed.data.returnTo,
    });
    if (!started.ok) return err(started.message);
    return ok({ url: started.url });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Admin: resolve a stuck pending claim ------------------------------------

// A customer's "I've paid" claim that the professional never confirmed sits
// pending forever without this. Staff can mark it recorded or void it; both
// are audited.
export async function adminResolvePendingPayment(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireDeskStaff();
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

    // CAS: a professional recording the payment at the same moment wins.
    const updated = await db
      .update(payments)
      .set({ status: parsed.data.to, updatedAt: new Date() })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
      .returning({ id: payments.id });
    if (updated.length === 0) {
      return err("This payment just changed state — reload and check again.");
    }

    const booking = payment.bookingId
      ? (
          await db
            .select()
            .from(bookings)
            .where(eq(bookings.id, payment.bookingId))
        )[0]
      : undefined;

    // Marking a payment recorded confirms the booking the same way the
    // professional recording it would.
    if (parsed.data.to === "succeeded" && booking?.status === "accepted") {
      await transitionBooking({
        booking,
        to: "confirmed",
        actorUserId: actor.id,
        note: "payment marked recorded by staff",
      });
    } else if (booking) {
      publishBooking(booking.id, bookingEventNow("payment"));
    }

    await writeAudit({
      actorUserId: actor.id,
      action: `payment.${parsed.data.to === "succeeded" ? "mark_recorded" : "void"}`,
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
        body: "Our team recorded your payment to your professional. Thank you!",
        meta: booking ? { bookingId: booking.id } : undefined,
      });
    }

    revalidatePath("/admin/payments");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Admin: mark a recorded payment refunded ---------------------------------

// A RECORD, not a money movement. CheersJA never held this money, so nothing
// is sent anywhere by this action — it marks the ledger to match a refund the
// professional has already made directly to the customer.
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
    if (payment.status !== "succeeded") {
      return err("Only recorded payments can be marked refunded.");
    }

    // CAS so a concurrent write can't fight this one.
    const updated = await db
      .update(payments)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(
        and(eq(payments.id, payment.id), eq(payments.status, "succeeded"))
      )
      .returning({ id: payments.id });
    if (updated.length === 0) {
      return err("This payment just changed state — reload and check again.");
    }

    const booking = payment.bookingId
      ? (
          await db
            .select()
            .from(bookings)
            .where(eq(bookings.id, payment.bookingId))
        )[0]
      : undefined;
    if (
      booking &&
      booking.status !== "refunded" &&
      booking.status !== "cancelled"
    ) {
      await transitionBooking({
        booking,
        to: "refunded",
        actorUserId: admin.id,
        note: parsed.data.note ?? "refund recorded",
      });
    } else if (booking) {
      publishBooking(booking.id, bookingEventNow("payment"));
    }

    await writeAudit({
      actorUserId: admin.id,
      action: "payment.mark_refunded",
      entity: "payments",
      entityId: payment.id,
      before: { status: "succeeded" },
      after: { status: "refunded", note: parsed.data.note },
    });
    await notify({
      userId: payment.customerId,
      type: "payment_refunded",
      title: "Your payment was marked refunded",
      body: `Booking ${booking?.code ?? ""} is recorded as refunded. CheersJA never held this money — your professional returns it to you directly, so speak to them if it hasn't arrived.`,
      meta: booking ? { bookingId: booking.id } : undefined,
    });

    revalidatePath("/admin/payments");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Admin: the professional's monthly commission statements -----------------

async function loadInvoice(invoiceId: string) {
  const [row] = await db
    .select({ invoice: feeInvoices, userId: workers.userId, stageName: workers.stageName })
    .from(feeInvoices)
    .innerJoin(workers, eq(feeInvoices.workerId, workers.id))
    .where(eq(feeInvoices.id, invoiceId));
  return row ?? null;
}

// Run the same charge the clock runs, now.
export async function adminRetryFeeInvoice(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = feeInvoiceSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const row = await loadInvoice(parsed.data.invoiceId);
    if (!row) return err(ERR.notFound);
    if (!paymentsConfigured()) {
      return err("Card payments are not set up yet — nothing can be charged.");
    }

    const result = await chargeFeeInvoice(row.invoice.id);
    await writeAudit({
      actorUserId: admin.id,
      action: "fee_invoice.retry",
      entity: "fee_invoices",
      entityId: row.invoice.id,
      before: { status: row.invoice.status, attempts: row.invoice.attempts },
      after: result.ok
        ? { status: "paid", transactionId: result.transactionId }
        : { message: result.message },
    });

    revalidatePath("/admin/payments");
    revalidatePath("/worker/earnings");
    return result.ok ? ok(undefined) : err(result.message);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Settled outside the gateway (a bank transfer, cash in the office). Records
// it against the statement so the professional stops being chased.
export async function adminMarkFeeInvoicePaid(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = feeInvoiceSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const row = await loadInvoice(parsed.data.invoiceId);
    if (!row) return err(ERR.notFound);
    if (row.invoice.status === "paid") {
      return err("This statement is already settled.");
    }

    const now = new Date();
    const note = parsed.data.note ?? "Settled outside the card gateway.";
    const updated = await db
      .update(feeInvoices)
      .set({ status: "paid", paidAt: now, note, updatedAt: now })
      .where(
        and(
          eq(feeInvoices.id, row.invoice.id),
          eq(feeInvoices.status, row.invoice.status)
        )
      )
      .returning({ id: feeInvoices.id });
    if (updated.length === 0) {
      return err("This statement just changed — reload and check again.");
    }

    await writeAudit({
      actorUserId: admin.id,
      action: "fee_invoice.mark_paid",
      entity: "fee_invoices",
      entityId: row.invoice.id,
      before: { status: row.invoice.status },
      after: { status: "paid", note },
    });
    await notify({
      userId: row.userId,
      type: "fee_invoice_paid",
      title: `Commission settled — ${periodLabel(row.invoice)}`,
      body: `${formatCents(row.invoice.amountCents)} is recorded as settled. ${note}`,
      meta: { url: "/worker/earnings" },
    });

    revalidatePath("/admin/payments");
    revalidatePath("/worker/earnings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Write the commission off. If it was already charged to a card, the money
// goes back — this is the one refund the platform can actually make, because
// it is the one payment it actually received.
export async function adminWaiveFeeInvoice(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = feeInvoiceSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const row = await loadInvoice(parsed.data.invoiceId);
    if (!row) return err(ERR.notFound);
    if (row.invoice.status === "waived") {
      return err("This statement is already waived.");
    }

    let refunded = false;
    if (row.invoice.status === "paid" && row.invoice.gatewayTransactionId) {
      refunded = await refundTransaction(
        row.invoice.gatewayTransactionId,
        row.invoice.amountCents
      );
      if (!refunded) {
        return err(
          "The gateway would not refund the charge. Refund it from the gateway console, then waive this statement."
        );
      }
    }

    const now = new Date();
    const note =
      parsed.data.note ??
      (refunded ? "Waived and refunded to the card." : "Waived by an admin.");
    const updated = await db
      .update(feeInvoices)
      .set({ status: "waived", note, updatedAt: now })
      .where(
        and(
          eq(feeInvoices.id, row.invoice.id),
          eq(feeInvoices.status, row.invoice.status)
        )
      )
      .returning({ id: feeInvoices.id });
    if (updated.length === 0) {
      return err("This statement just changed — reload and check again.");
    }

    await writeAudit({
      actorUserId: admin.id,
      action: "fee_invoice.waive",
      entity: "fee_invoices",
      entityId: row.invoice.id,
      before: { status: row.invoice.status, amountCents: row.invoice.amountCents },
      after: { status: "waived", refunded, note },
    });
    await notify({
      userId: row.userId,
      type: "fee_invoice_waived",
      title: `Commission waived — ${periodLabel(row.invoice)}`,
      body: `${formatCents(row.invoice.amountCents)} has been waived${
        refunded ? " and refunded to your card" : ""
      }. ${note}`,
      meta: { url: "/worker/earnings" },
    });
    await notifyAdmins({
      type: "fee_invoice_waived",
      title: `Commission waived — ${row.stageName}`,
      body: `${formatCents(row.invoice.amountCents)} for ${periodLabel(
        row.invoice
      )} was waived by an admin.`,
      email: false,
    });

    revalidatePath("/admin/payments");
    revalidatePath("/worker/earnings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
