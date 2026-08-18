import Link from "next/link";
import { and, count, desc, eq, isNull, ne, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  bookings,
  customerVerifications,
  driverVerifications,
  payments,
  safetyAlerts,
  safetySessions,
  users,
  workers,
} from "@/db/schema";
import Badge from "@/components/ui/Badge";
import { formatCents } from "@/lib/constants";
import { statusTone } from "@/lib/status";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const [
    [revenue],
    [bookingCount],
    [customerCount],
    [workerCount],
    [pendingVerifications],
    [pendingWorkers],
    [pendingDrivers],
    recent,
    [openAlerts],
    [liveSessions],
  ] = await Promise.all([
    db
      .select({ total: sum(payments.amountCents), fees: sum(payments.platformFeeCents) })
      .from(payments)
      .where(eq(payments.status, "succeeded")),
    db.select({ n: count() }).from(bookings),
    db.select({ n: count() }).from(users).where(eq(users.role, "customer")),
    db.select({ n: count() }).from(workers),
    db
      .select({ n: count() })
      .from(customerVerifications)
      .where(eq(customerVerifications.status, "pending")),
    db
      .select({ n: count() })
      .from(workers)
      .where(and(eq(workers.verified, false), eq(workers.suspended, false))),
    db
      .select({ n: count() })
      .from(driverVerifications)
      .where(eq(driverVerifications.status, "pending")),
    db
      .select()
      .from(bookings)
      .orderBy(desc(bookings.createdAt))
      .limit(8),
    db
      .select({ n: count() })
      .from(safetyAlerts)
      .where(isNull(safetyAlerts.resolvedAt)),
    db
      .select({ n: count() })
      .from(safetySessions)
      .where(ne(safetySessions.state, "ended")),
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

  const pendingCount = pendingVerifications?.n ?? 0;
  const pendingWorkerCount = pendingWorkers?.n ?? 0;
  const pendingDriverCount = pendingDrivers?.n ?? 0;
  const alertCount = openAlerts?.n ?? 0;
  const liveCount = liveSessions?.n ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-ink">Platform overview</h1>

      {/* Safety comes first, above revenue. An open alert is the only thing on
          this page that can still be made worse by being seen late. */}
      {alertCount > 0 && (
        <Link
          href="/safety"
          className="card flex items-center justify-between gap-3 border-danger/60 bg-danger/5 p-4 hover:border-danger"
        >
          <p className="text-sm text-ink">
            <Badge tone="danger">{alertCount}</Badge>
            <span className="ml-3">
              unresolved safety alert{alertCount === 1 ? "" : "s"} — someone is
              waiting on a response
            </span>
          </p>
          <span className="shrink-0 text-sm text-gold">Open safety desk →</span>
        </Link>
      )}

      {alertCount === 0 && liveCount > 0 && (
        <Link
          href="/safety"
          className="card flex items-center justify-between gap-3 p-4 hover:border-gold/40"
        >
          <p className="text-sm text-muted">
            <Badge tone="success">{liveCount}</Badge>
            <span className="ml-3">
              monitored visit{liveCount === 1 ? "" : "s"} in progress — all
              checked in
            </span>
          </p>
          <span className="shrink-0 text-sm text-gold">Live board →</span>
        </Link>
      )}

      {pendingCount > 0 && (
        <Link
          href="/admin/verifications"
          className="card flex items-center justify-between gap-3 border-warn/40 p-4 hover:border-warn"
        >
          <p className="text-sm text-ink">
            <Badge tone="warn">{pendingCount}</Badge>
            <span className="ml-3">
              customer verification{pendingCount === 1 ? "" : "s"} awaiting
              review
            </span>
          </p>
          <span className="text-sm text-gold">Review →</span>
        </Link>
      )}

      {pendingWorkerCount > 0 && (
        <Link
          href="/admin/workers"
          className="card flex items-center justify-between gap-3 border-warn/40 p-4 hover:border-warn"
        >
          <p className="text-sm text-ink">
            <Badge tone="warn">{pendingWorkerCount}</Badge>
            <span className="ml-3">
              worker profile{pendingWorkerCount === 1 ? "" : "s"} awaiting
              approval (hidden from the site until approved)
            </span>
          </p>
          <span className="text-sm text-gold">Review →</span>
        </Link>
      )}

      {pendingDriverCount > 0 && (
        <Link
          href="/admin/drivers"
          className="card flex items-center justify-between gap-3 border-warn/40 p-4 hover:border-warn"
        >
          <p className="text-sm text-ink">
            <Badge tone="warn">{pendingDriverCount}</Badge>
            <span className="ml-3">
              driver verification{pendingDriverCount === 1 ? "" : "s"} awaiting
              review (profile goes live on approval)
            </span>
          </p>
          <span className="text-sm text-gold">Review →</span>
        </Link>
      )}

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
