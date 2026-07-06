import { count, eq, gte, sql, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, payments, users } from "@/db/schema";
import { formatCents } from "@/lib/constants";

export const metadata: Metadata = { title: "Reports — Admin" };

export default async function AdminReportsPage() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [[monthRevenue], [monthBookings], [newCustomers], [refunds], byStatus] =
    await Promise.all([
      db
        .select({ total: sum(payments.amountCents), fees: sum(payments.platformFeeCents) })
        .from(payments)
        .where(eq(payments.status, "succeeded")),
      db.select({ n: count() }).from(bookings),
      db
        .select({ n: count() })
        .from(users)
        .where(gte(users.createdAt, monthStart)),
      db
        .select({ n: count(), total: sum(payments.amountCents) })
        .from(payments)
        .where(eq(payments.status, "refunded")),
      db
        .select({ status: bookings.status, n: count() })
        .from(bookings)
        .groupBy(bookings.status)
        .orderBy(sql`count(*) desc`),
    ]);

  const cards = [
    { label: "Gross revenue (all time)", value: formatCents(Number(monthRevenue?.total ?? 0)) },
    { label: "Platform fees earned", value: formatCents(Number(monthRevenue?.fees ?? 0)) },
    { label: "Total bookings", value: String(monthBookings?.n ?? 0) },
    { label: "New users this month", value: String(newCustomers?.n ?? 0) },
    {
      label: "Refunds",
      value: `${refunds?.n ?? 0} (${formatCents(Number(refunds?.total ?? 0))})`,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">Reports</h1>
        <div className="flex gap-2">
          <a href="/admin/reports/export?type=bookings" className="btn-outline text-xs">
            Export bookings CSV
          </a>
          <a href="/admin/reports/export?type=payments" className="btn-outline text-xs">
            Export payments CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs uppercase tracking-wider text-faint">{c.label}</p>
            <p className="font-display mt-2 text-lg text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Bookings by status
        </h2>
        <ul className="mt-4 space-y-2">
          {byStatus.map((row) => {
            const total = byStatus.reduce((s, r) => s + Number(r.n), 0);
            const pct = total > 0 ? (Number(row.n) / total) * 100 : 0;
            return (
              <li key={row.status} className="flex items-center gap-3 text-sm">
                <span className="w-28 capitalize text-muted">{row.status}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                  <span
                    className="block h-full rounded-full bg-gold/70"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-10 text-right text-ink">{String(row.n)}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-faint">
          PDF export: print this page (Ctrl+P → Save as PDF). Dedicated PDF
          generation is on the future-ready list.
        </p>
      </section>
    </div>
  );
}
