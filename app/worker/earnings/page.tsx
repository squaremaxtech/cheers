import { and, count, desc, eq, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, payouts } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import { formatCents, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Earnings" };

export default async function WorkerEarningsPage() {
  const { worker } = await getWorkerContext();

  const [[completed], payoutRows] = await Promise.all([
    db
      .select({
        jobs: count(),
        gross: sum(bookings.priceCents),
        addons: sum(bookings.addonsCents),
        fees: sum(bookings.platformFeeCents),
        tips: sum(bookings.tipCents),
      })
      .from(bookings)
      .where(
        and(eq(bookings.workerId, worker.id), eq(bookings.status, "completed"))
      ),
    db
      .select()
      .from(payouts)
      .where(eq(payouts.workerId, worker.id))
      .orderBy(desc(payouts.periodStart)),
  ]);

  const gross =
    Number(completed?.gross ?? 0) + Number(completed?.addons ?? 0);
  const fees = Number(completed?.fees ?? 0);
  const tips = Number(completed?.tips ?? 0);
  const net = gross - fees + tips;
  const pendingPayout = payoutRows
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.amountCents + p.tipsCents, 0);

  const cards = [
    { label: "Jobs completed", value: String(completed?.jobs ?? 0) },
    { label: "Total earned (net)", value: formatCents(net) },
    { label: "Tips (100% yours)", value: formatCents(tips) },
    { label: "Pending payout", value: formatCents(pendingPayout) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-ink">Earnings</h1>
        <p className="mt-1 text-sm text-muted">
          Settled weekly. Card bookings are paid out to you minus the{" "}
          {PLATFORM_FEE_PERCENT}% platform fee; cash you keep at the meeting,
          with the {PLATFORM_FEE_PERCENT}% fee netted against your payout.
          Tips are never touched.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs uppercase tracking-wider text-faint">{c.label}</p>
            <p className="font-display mt-2 text-2xl text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Payout history
        </h2>
        {payoutRows.length === 0 ? (
          <p className="mt-3 text-sm text-faint">
            No payouts yet — they appear after your first completed week.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline text-sm">
            {payoutRows.map((p) => {
              const total = p.amountCents + p.tipsCents;
              return (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <span className="text-muted">
                    {p.periodStart} → {p.periodEnd}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={total < 0 ? "text-warn" : "text-ink"}>
                      {formatCents(total)}
                      {total < 0 ? (
                        <span className="ml-1 text-xs text-faint">
                          cash-week fees you owe
                        </span>
                      ) : (
                        p.tipsCents > 0 && (
                          <span className="ml-1 text-xs text-faint">
                            (incl. {formatCents(p.tipsCents)} tips)
                          </span>
                        )
                      )}
                    </span>
                    <Badge tone={p.status === "paid" ? "success" : "warn"}>
                      {p.status === "paid"
                        ? total < 0
                          ? "settled"
                          : "paid"
                        : "pending"}
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
