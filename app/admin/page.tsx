import Link from "next/link";
import { count, desc, eq, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, payments, users, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import { formatCents } from "@/lib/constants";
import { statusTone } from "@/lib/status";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const [[revenue], [bookingCount], [customerCount], [workerCount], recent] =
    await Promise.all([
      db
        .select({ total: sum(payments.amountCents), fees: sum(payments.platformFeeCents) })
        .from(payments)
        .where(eq(payments.status, "succeeded")),
      db.select({ n: count() }).from(bookings),
      db.select({ n: count() }).from(users).where(eq(users.role, "customer")),
      db.select({ n: count() }).from(workers),
      db
        .select()
        .from(bookings)
        .orderBy(desc(bookings.createdAt))
        .limit(8),
    ]);

  const cards = [
    {
      label: "Gross revenue",
      value: formatCents(Number(revenue?.total ?? 0)),
      href: "/admin/payments",
    },
    {
      label: "Platform fees",
      value: formatCents(Number(revenue?.fees ?? 0)),
      href: "/admin/reports",
    },
    { label: "Bookings", value: String(bookingCount?.n ?? 0), href: "/admin/bookings" },
    { label: "Customers", value: String(customerCount?.n ?? 0), href: "/admin" },
    { label: "Workers", value: String(workerCount?.n ?? 0), href: "/admin/workers" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-ink">Platform overview</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card p-5 hover:border-gold/40">
            <p className="text-xs uppercase tracking-wider text-faint">{c.label}</p>
            <p className="font-display mt-2 text-xl text-ink">{c.value}</p>
          </Link>
        ))}
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Latest bookings
          </h2>
          <Link href="/admin/bookings" className="text-sm text-gold">
            Manage →
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="pb-2">Code</th>
                <th className="pb-2">Service</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {recent.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 text-faint">{b.code}</td>
                  <td className="py-2.5 text-ink">{b.serviceName}</td>
                  <td className="py-2.5 text-muted">{b.date}</td>
                  <td className="py-2.5 text-ink">
                    {formatCents(b.priceCents + b.addonsCents + b.tipCents)}
                  </td>
                  <td className="py-2.5">
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
