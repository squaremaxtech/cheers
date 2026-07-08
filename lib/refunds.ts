import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { notify, notifyAdmins } from "@/lib/notify";
import { refundGatewayPayment } from "@/lib/powertranz";
import type { BookingRow } from "@/types";

// Refund every payment on a booking (used when a paid booking is cancelled).
// Card payments are refunded through the PowerTranz gateway automatically;
// cash payments (and card refund failures) escalate to admins for manual
// handling. Pending payments are voided. Never throws — the cancellation
// itself must not fail because a refund needs human follow-up.
export async function refundBookingPayments(booking: BookingRow): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, booking.id));

    for (const payment of rows) {
      if (payment.status === "pending") {
        // Nothing was collected — void the expectation.
        await db
          .update(payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(
            and(eq(payments.id, payment.id), eq(payments.status, "pending"))
          );
        continue;
      }
      if (payment.status !== "succeeded") continue;

      if (payment.method === "card" && payment.gatewayTransactionId) {
        const refunded = await refundGatewayPayment(
          payment.gatewayTransactionId,
          payment.amountCents
        );
        if (refunded) {
          await db
            .update(payments)
            .set({ status: "refunded", updatedAt: new Date() })
            .where(eq(payments.id, payment.id));
          await notify({
            userId: payment.customerId,
            type: "payment_refunded",
            title: `Refund issued for ${booking.code}`,
            body: "Your card refund is on its way — it typically lands within 5-10 business days.",
          });
          continue;
        }
      }

      // Cash payment or card auto-refund failure: humans take over.
      await notifyAdmins({
        type: "refund_required",
        title: `Manual refund required — ${booking.code}`,
        body: `Booking ${booking.code} was cancelled after a ${payment.method} payment succeeded. Process the refund from the admin payments view.`,
        meta: { bookingId: booking.id, paymentId: payment.id },
      });
    }
  } catch (error) {
    console.error(
      "refundBookingPayments failed:",
      error instanceof Error ? error.message : error
    );
  }
}
