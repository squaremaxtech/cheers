import { and, asc, desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, payments, payouts, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import PaymentAdminActions from "@/components/admin/PaymentAdminActions";
import PayoutControls from "@/components/admin/PayoutControls";
import { formatCents } from "@/lib/constants";
import { payoutContribution } from "@/lib/payouts";

export const metadata: Metadata = { title: "Payments — Admin" };

export default async function AdminPaymentsPage() {
  const [paymentRows, payoutRows, uncovered] = await Promise.all([
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
    // Completed bookings not yet covered by any payout — the work queue for
    // "Generate weekly payouts".
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        date: bookings.date,
        priceCents: bookings.priceCents,
        addonsCents: bookings.addonsCents,
        platformFeeCents: bookings.platformFeeCents,
        workerId: bookings.workerId,
        stageName: workers.stageName,
      })
      .from(bookings)
      .innerJoin(workers, eq(bookings.workerId, workers.id))
      .where(and(eq(bookings.status, "completed"), isNull(bookings.payoutId)))
      .orderBy(asc(bookings.date)),
  ]);

  // Two independent follow-ups — issue them concurrently: succeeded payments
  // of the uncovered bookings (method decides credit vs fee-debit), and the
  // booking codes behind each payout.
  const [paymentRowsForUncovered, payoutBookingRows] = await Promise.all([
    uncovered.length > 0
      ? db
          .select({
            bookingId: payments.bookingId,
            method: payments.method,
            tipCents: payments.tipCents,
          })
          .from(payments)
          .where(
            and(
              eq(payments.status, "succeeded"),
              inArray(payments.bookingId, uncovered.map((b) => b.id))
            )
          )
      : Promise.resolve([]),
    payoutRows.length > 0
      ? db
          .select({ payoutId: bookings.payoutId, code: bookings.code })
          .from(bookings)
          .where(
            and(
              isNotNull(bookings.payoutId),
              inArray(bookings.payoutId, payoutRows.map((p) => p.payout.id))
            )
          )
      : Promise.resolve([]),
  ]);

  const paymentsByBooking = new Map<
    string,
    { method: "card" | "cash"; tipCents: number }[]
  >();
  for (const r of paymentRowsForUncovered) {
    const list = paymentsByBooking.get(r.bookingId) ?? [];
    list.push({ method: r.method, tipCents: r.tipCents });
    paymentsByBooking.set(r.bookingId, list);
  }
  const awaitingByWorker = new Map<
    string,
    {
      stageName: string;
      codes: string[];
      netCents: number;
      tipsCents: number;
      minDate: string;
      maxDate: string;
    }
  >();
  const unpaidCompleted: { code: string; date: string }[] = [];
  for (const b of uncovered) {
    const pays = paymentsByBooking.get(b.id);
    if (!pays) {
      unpaidCompleted.push({ code: b.code, date: b.date });
      continue;
    }
    // Same net-settlement math as generation (lib/payouts.ts): card credits
    // the worker, cash debits them the platform fee.
    const contribution = payoutContribution(b, pays);
    const entry = awaitingByWorker.get(b.workerId) ?? {
      stageName: b.stageName,
      codes: [],
      netCents: 0,
      tipsCents: 0,
      minDate: b.date,
      maxDate: b.date,
    };
    entry.codes.push(b.code);
    entry.netCents += contribution.amountCents;
    entry.tipsCents += contribution.tipsCents;
    if (b.date < entry.minDate) entry.minDate = b.date;
    if (b.date > entry.maxDate) entry.maxDate = b.date;
    awaitingByWorker.set(b.workerId, entry);
  }
  const awaiting = [...awaitingByWorker.values()];
  const awaitingDates = awaiting
    .flatMap((a) => [a.minDate, a.maxDate])
    .sort();
  const defaultStart = awaitingDates[0];
  const defaultEnd = awaitingDates[awaitingDates.length - 1];

  // Booking codes behind each payout — the admin's verification trail.
  const payoutBookings = new Map<string, string[]>();
  for (const r of payoutBookingRows) {
    if (!r.payoutId) continue;
    const list = payoutBookings.get(r.payoutId) ?? [];
    list.push(r.code);
    payoutBookings.set(r.payoutId, list);
  }

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

      {/* What still needs a payout — feeds the generate controls below. */}
      <div>
        <h2 className="font-display text-xl text-ink">Awaiting payout</h2>
        <p className="mt-1 text-sm text-muted">
          Paid, completed bookings not yet covered by a payout. Card bookings
          credit the worker; cash bookings (money already in their hand)
          debit the platform fee — a negative net means the worker owes the
          platform for that span. Generate a period below that covers the
          service dates.
        </p>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Worker</th>
                <th className="p-3">Bookings</th>
                <th className="p-3">Service dates</th>
                <th className="p-3">Net</th>
                <th className="p-3">Card tips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {awaiting.map((a) => (
                <tr key={a.stageName}>
                  <td className="p-3 text-ink">{a.stageName}</td>
                  <td className="p-3 text-muted" title={a.codes.join(", ")}>
                    {a.codes.length} ({a.codes.join(", ")})
                  </td>
                  <td className="p-3 text-muted">
                    {a.minDate === a.maxDate
                      ? a.minDate
                      : `${a.minDate} → ${a.maxDate}`}
                  </td>
                  <td className={`p-3 ${a.netCents < 0 ? "text-warn" : "text-ink"}`}>
                    {formatCents(a.netCents)}
                    {a.netCents < 0 && (
                      <span className="ml-1 text-xs text-faint">
                        owes platform
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-muted">{formatCents(a.tipsCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {awaiting.length === 0 && (
            <p className="p-6 text-sm text-faint">
              Nothing awaiting payout — every paid, completed booking is
              covered.
            </p>
          )}
        </div>
        {unpaidCompleted.length > 0 && (
          <p className="mt-3 text-xs text-warn">
            {unpaidCompleted.length} completed booking(s) have no recorded
            payment and can&apos;t be paid out:{" "}
            {unpaidCompleted.map((b) => b.code).join(", ")} — resolve them in
            the payments table above.
          </p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Weekly payouts</h2>
          <PayoutControls defaultStart={defaultStart} defaultEnd={defaultEnd} />
        </div>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Worker</th>
                <th className="p-3">Period</th>
                <th className="p-3">Bookings</th>
                <th className="p-3">Earnings</th>
                <th className="p-3">Tips</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {payoutRows.map(({ payout, stageName }) => {
                const codes = payoutBookings.get(payout.id) ?? [];
                const owes = payout.amountCents + payout.tipsCents < 0;
                return (
                  <tr key={payout.id}>
                    <td className="p-3 text-ink">{stageName}</td>
                    <td className="p-3 text-muted">
                      {payout.periodStart} → {payout.periodEnd}
                    </td>
                    <td className="p-3 text-muted" title={codes.join(", ")}>
                      {codes.length}
                    </td>
                    <td className={`p-3 ${owes ? "text-warn" : "text-ink"}`}>
                      {formatCents(payout.amountCents)}
                      {owes && (
                        <span className="ml-1 text-xs text-faint">
                          owes platform
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted">{formatCents(payout.tipsCents)}</td>
                    <td className="p-3">
                      <Badge tone={payout.status === "paid" ? "success" : "warn"}>
                        {payout.status}
                      </Badge>
                      {payout.status === "paid" && payout.paidAt && (
                        <span
                          className="ml-2 text-xs text-faint"
                          title={payout.note ?? undefined}
                        >
                          {payout.paidAt.toISOString().slice(0, 10)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {payout.status === "pending" && (
                        <PaymentAdminActions
                          payoutId={payout.id}
                          payoutOwed={owes}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
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
