import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, workers } from "@/db/schema";
import { formatCents } from "@/lib/constants";
import { notify, notifyAdmins } from "@/lib/notify";
import { jobPaymentMethodLabel } from "@/lib/payments/config";
import type { BookingRow } from "@/types";

// What happens to money on a cancelled booking.
//
// THE PLATFORM HOLDS NOTHING, so it cannot refund anything. A customer pays
// their professional directly — cash, bank transfer, Lynk — and the app only
// records that it happened. When a booking with a recorded payment is
// cancelled, the honest thing (and the only possible thing) is to tell both
// parties plainly that the refund is between them, and to put it in front of
// staff so someone can help if it goes wrong.
//
// Never throws: cancelling a booking must not fail because a notice could not
// be sent.
export async function refundBookingPayments(booking: BookingRow): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, booking.id));

    const [worker] = await db
      .select({ userId: workers.userId, stageName: workers.stageName })
      .from(workers)
      .where(eq(workers.id, booking.workerId));

    for (const payment of rows) {
      if (payment.status === "pending") {
        // Nothing was ever paid — void the expectation and move on.
        await db
          .update(payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(
            and(eq(payments.id, payment.id), eq(payments.status, "pending"))
          );
        continue;
      }
      if (payment.status !== "succeeded") continue;

      const amount = formatCents(payment.amountCents);
      const method = jobPaymentMethodLabel(payment.method);

      await notify({
        userId: payment.customerId,
        type: "refund_arranged_directly",
        title: `Booking ${booking.code} was cancelled after you paid`,
        body: `You paid ${amount} by ${method} directly to ${
          worker?.stageName ?? "your professional"
        }. CheersJA never held that money, so the refund is arranged between the two of you — message them from your booking. If you cannot reach them, contact support and we will step in.`,
        meta: { bookingId: booking.id },
      });

      if (worker) {
        await notify({
          userId: worker.userId,
          type: "refund_arranged_directly",
          title: `Refund owed on ${booking.code}`,
          body: `This booking was cancelled after ${amount} was recorded as paid to you by ${method}. That money went straight to you, so please return it to the customer directly and let them know.`,
          meta: { bookingId: booking.id },
        });
      }

      await notifyAdmins({
        type: "refund_required",
        title: `Direct refund to follow up — ${booking.code}`,
        body: `${amount} (${method}) was recorded as paid before this booking was cancelled. The platform held none of it; both parties have been told to settle it between themselves. Check in if either one asks for help.`,
        meta: { bookingId: booking.id, paymentId: payment.id },
        email: false,
      });
    }
  } catch (error) {
    console.error(
      "refundBookingPayments failed:",
      error instanceof Error ? error.message : error
    );
  }
}
