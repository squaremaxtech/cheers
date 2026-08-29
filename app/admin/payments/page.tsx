import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, feeInvoices, payments, rides, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import FeeInvoiceControls from "@/components/admin/FeeInvoiceControls";
import PaymentAdminActions from "@/components/admin/PaymentAdminActions";
import { getUserRow } from "@/lib/auth";
import { periodLabel } from "@/lib/billing";
import { formatCents, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { jobPaymentMethodLabel } from "@/lib/payments/config";
import { paymentsConfigured } from "@/lib/payments/powertranz";
import type { FeeInvoiceStatus } from "@/types";

export const metadata: Metadata = { title: "Payments — Admin" };

const INVOICE_LABELS: Record<FeeInvoiceStatus, string> = {
  open: "Accruing",
  due: "Due",
  paid: "Paid",
  failed: "Charge failed",
  waived: "Waived",
};

function invoiceTone(
  status: FeeInvoiceStatus
): "success" | "warn" | "danger" | "neutral" {
  if (status === "paid") return "success";
  if (status === "failed") return "danger";
  if (status === "due") return "warn";
  return "neutral";
}

// Two ledgers, and they are not the same kind of thing.
//
//   1. RECORDED JOB PAYMENTS — read-only. A customer paid their professional
//      directly; CheersJA never received a cent of it. Staff can resolve a
//      stuck claim or mark one refunded, but nothing here moves money.
//   2. COMMISSION STATEMENTS — the platform's actual revenue: 5% of each
//      completed job, billed monthly to the professional's card.
//
// There is no payout table on this page any more. Money only comes in.
export default async function AdminPaymentsPage() {
  const viewer = await getUserRow();
  const isAdmin = viewer?.role === "admin";
  const paymentsLive = paymentsConfigured();

  const [paymentRows, invoiceRows] = await Promise.all([
    // A payment belongs to a booking OR a ride (bookingId is nullable) —
    // left-join both so ride payments show up too.
    db
      .select({
        payment: payments,
        bookingCode: bookings.code,
        rideCode: rides.code,
      })
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id))
      .leftJoin(rides, eq(payments.rideId, rides.id))
      .orderBy(desc(payments.createdAt))
      .limit(100),
    db
      .select({ invoice: feeInvoices, stageName: workers.stageName })
      .from(feeInvoices)
      .innerJoin(workers, eq(feeInvoices.workerId, workers.id))
      .orderBy(desc(feeInvoices.periodStart), desc(feeInvoices.createdAt))
      .limit(200),
  ]);

  // The completed jobs behind each statement — the verification trail.
  const invoiceIds = invoiceRows.map((r) => r.invoice.id);
  const invoiceBookingRows =
    invoiceIds.length > 0
      ? await db
          .select({ feeInvoiceId: bookings.feeInvoiceId, code: bookings.code })
          .from(bookings)
          .where(inArray(bookings.feeInvoiceId, invoiceIds))
      : [];
  const invoiceBookings = new Map<string, string[]>();
  for (const row of invoiceBookingRows) {
    if (!row.feeInvoiceId) continue;
    const list = invoiceBookings.get(row.feeInvoiceId) ?? [];
    list.push(row.code);
    invoiceBookings.set(row.feeInvoiceId, list);
  }

  const outstanding = invoiceRows
    .filter((r) => r.invoice.status === "due" || r.invoice.status === "failed")
    .reduce((sum, r) => sum + r.invoice.amountCents, 0);
  const collected = invoiceRows
    .filter((r) => r.invoice.status === "paid")
    .reduce((sum, r) => sum + r.invoice.amountCents, 0);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl text-ink">Payments</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          Customers pay professionals <strong>directly</strong> — cash, bank
          transfer or Lynk. CheersJA never receives, holds or forwards that money,
          so the table below is a record, not a balance, and there is nothing to
          pay out. Platform revenue is the {PLATFORM_FEE_PERCENT}% commission
          billed to professionals monthly, and customer memberships.
        </p>
      </div>

      <div>
        <h2 className="font-display text-xl text-ink">Recorded job payments</h2>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Booking / Ride</th>
                <th className="p-3">Paid to professional</th>
                <th className="p-3">Tip</th>
                <th className="p-3">Commission</th>
                <th className="p-3">How</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {paymentRows.map(({ payment, bookingCode, rideCode }) => (
                <tr key={payment.id}>
                  <td className="p-3 text-faint">
                    {bookingCode ?? rideCode ?? "—"}
                  </td>
                  <td className="p-3 text-ink">
                    {formatCents(payment.amountCents)}
                  </td>
                  <td className="p-3 text-muted">
                    {formatCents(payment.tipCents)}
                  </td>
                  <td className="p-3 text-muted">
                    {formatCents(payment.platformFeeCents)}
                  </td>
                  <td className="p-3 text-muted">
                    {jobPaymentMethodLabel(payment.method)}
                    {payment.cashProofUrl && (
                      <span className="ml-1 text-xs text-faint">
                        · {payment.cashProofUrl}
                      </span>
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
                      {payment.status === "pending"
                        ? "claimed"
                        : payment.status === "succeeded"
                          ? "confirmed"
                          : payment.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <PaymentAdminActions
                      paymentId={payment.id}
                      status={payment.status}
                      isAdmin={isAdmin}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paymentRows.length === 0 && (
            <p className="p-6 text-sm text-faint">No payments recorded yet.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-faint">
          &ldquo;Claimed&rdquo; means the customer says they paid and the
          professional has not confirmed it yet. Marking one recorded or
          refunded here changes the record only — no money moves either way.
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">
              Commission statements
            </h2>
            <p className="mt-1 text-sm text-muted">
              {formatCents(collected)} collected · {formatCents(outstanding)}{" "}
              outstanding.
              {!paymentsLive &&
                " Card payments aren't configured, so statements accrue and close but nothing is charged."}
            </p>
          </div>
        </div>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Professional</th>
                <th className="p-3">Period</th>
                <th className="p-3">Jobs</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Note</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {invoiceRows.map(({ invoice, stageName }) => {
                const codes = invoiceBookings.get(invoice.id) ?? [];
                return (
                  <tr key={invoice.id}>
                    <td className="p-3 text-ink">{stageName}</td>
                    <td className="p-3 text-muted">{periodLabel(invoice)}</td>
                    <td className="p-3 text-muted" title={codes.join(", ")}>
                      {invoice.jobCount}
                    </td>
                    <td className="p-3 text-ink">
                      {formatCents(invoice.amountCents)}
                    </td>
                    <td className="p-3">
                      <Badge tone={invoiceTone(invoice.status)}>
                        {INVOICE_LABELS[invoice.status]}
                      </Badge>
                      {invoice.attempts > 0 && invoice.status !== "paid" && (
                        <span className="ml-2 text-xs text-faint">
                          {invoice.attempts} attempt
                          {invoice.attempts === 1 ? "" : "s"}
                        </span>
                      )}
                      {invoice.paidAt && (
                        <span className="ml-2 text-xs text-faint">
                          {invoice.paidAt.toISOString().slice(0, 10)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-faint">
                      {invoice.note ?? "—"}
                    </td>
                    <td className="p-3">
                      {isAdmin && invoice.status !== "open" && (
                        <FeeInvoiceControls
                          invoiceId={invoice.id}
                          status={invoice.status}
                          paymentsLive={paymentsLive}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {invoiceRows.length === 0 && (
            <p className="p-6 text-sm text-faint">
              No statements yet — the first one opens when a job completes.
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-faint">
          Statements close at the end of each month and are charged to the
          professional&apos;s card a few days later. Failed charges retry daily;
          after that they are chased here. A professional whose commission has
          failed past the grace period has their listings paused until it
          clears.
        </p>
      </div>
    </div>
  );
}
