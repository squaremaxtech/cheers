import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, payments, payouts, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import PaymentAdminActions from "@/components/admin/PaymentAdminActions";
import PayoutControls from "@/components/admin/PayoutControls";
import { formatCents } from "@/lib/constants";

export const metadata: Metadata = { title: "Payments — Admin" };

export default async function AdminPaymentsPage() {
  const [paymentRows, payoutRows] = await Promise.all([
    db
      .select({ payment: payments, code: bookings.code })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .orderBy(desc(payments.createdAt))
      .limit(100),
    db
      .select({ payout: payouts, stageName: workers.stageName })
      .from(payouts)
      .innerJoin(workers, eq(payouts.workerId, workers.id))
      .orderBy(desc(payouts.periodStart))
      .limit(100),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl text-ink">Payments</h1>
        <div className="card mt-6 overflow-x-auto p-2">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Booking</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Tip</th>
                <th className="p-3">Fee</th>
                <th className="p-3">Method</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {paymentRows.map(({ payment, code }) => (
                <tr key={payment.id}>
                  <td className="p-3 text-faint">{code}</td>
                  <td className="p-3 text-ink">{formatCents(payment.amountCents)}</td>
                  <td className="p-3 text-muted">{formatCents(payment.tipCents)}</td>
                  <td className="p-3 text-muted">
                    {formatCents(payment.platformFeeCents)}
                  </td>
                  <td className="p-3 text-muted">
                    {payment.method}
                    {payment.cashProofUrl && (
                      <a
                        href={payment.cashProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-gold"
                      >
                        proof
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge
                      tone={
                        payment.status === "succeeded"
                          ? "success"
                          : payment.status === "refunded" ||
                              payment.status === "failed"
                            ? "danger"
                            : "warn"
                      }
                    >
                      {payment.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <PaymentAdminActions
                      paymentId={payment.id}
                      status={payment.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paymentRows.length === 0 && (
            <p className="p-6 text-sm text-faint">No payments yet.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Weekly payouts</h2>
          <PayoutControls />
        </div>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Worker</th>
                <th className="p-3">Period</th>
                <th className="p-3">Earnings</th>
                <th className="p-3">Tips</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {payoutRows.map(({ payout, stageName }) => (
                <tr key={payout.id}>
                  <td className="p-3 text-ink">{stageName}</td>
                  <td className="p-3 text-muted">
                    {payout.periodStart} → {payout.periodEnd}
                  </td>
                  <td className="p-3 text-ink">{formatCents(payout.amountCents)}</td>
                  <td className="p-3 text-muted">{formatCents(payout.tipsCents)}</td>
                  <td className="p-3">
                    <Badge tone={payout.status === "paid" ? "success" : "warn"}>
                      {payout.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {payout.status === "pending" && (
                      <PaymentAdminActions payoutId={payout.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payoutRows.length === 0 && (
            <p className="p-6 text-sm text-faint">
              No payouts generated yet — use “Generate weekly payouts”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
