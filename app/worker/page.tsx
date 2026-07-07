import Link from "next/link";
import { and, count, eq, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, payouts } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import VisibilityToggle from "@/components/worker/VisibilityToggle";
import { formatCents } from "@/lib/constants";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Worker Dashboard" };

export default async function WorkerDashboard() {
  const { worker } = await getWorkerContext();

  const [[pendingCount], [upcomingCount], [completedStats], [pendingPayout]] =
    await Promise.all([
      db
        .select({ n: count() })
        .from(bookings)
        .where(
          and(eq(bookings.workerId, worker.id), eq(bookings.status, "pending"))
        ),
      db
        .select({ n: count() })
        .from(bookings)
        .where(
          and(eq(bookings.workerId, worker.id), eq(bookings.status, "confirmed"))
        ),
      db
        .select({
          n: count(),
          earned: sum(bookings.priceCents),
          tips: sum(bookings.tipCents),
        })
        .from(bookings)
        .where(
          and(eq(bookings.workerId, worker.id), eq(bookings.status, "completed"))
        ),
      db
        .select({ amount: sum(payouts.amountCents), tips: sum(payouts.tipsCents) })
        .from(payouts)
        .where(
          and(eq(payouts.workerId, worker.id), eq(payouts.status, "pending"))
        ),
    ]);

  const stats = [
    { label: "New requests", value: String(pendingCount?.n ?? 0), href: "/worker/bookings" },
    { label: "Upcoming", value: String(upcomingCount?.n ?? 0), href: "/worker/bookings" },
    { label: "Jobs completed", value: String(completedStats?.n ?? 0), href: "/worker/earnings" },
    {
      label: "Pending payout",
      value: formatCents(
        Number(pendingPayout?.amount ?? 0) + Number(pendingPayout?.tips ?? 0)
      ),
      href: "/worker/earnings",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{worker.stageName}</h1>
          <div className="mt-2 flex items-center gap-2">
            {worker.verified ? (
              <Badge tone="gold">Verified</Badge>
            ) : (
              <Badge>Verification pending</Badge>
            )}
            {worker.suspended && <Badge tone="danger">Suspended by admin</Badge>}
          </div>
        </div>
        <VisibilityToggle active={worker.active} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:border-gold/40">
            <p className="text-xs uppercase tracking-wider text-faint">{s.label}</p>
            <p className="font-display mt-2 text-2xl text-ink">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="card velvet p-6">
        <h2 className="font-display text-lg text-ink">Make your profile shine</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Profiles with photos, a rich bio, and 3+ services get booked far more
          often. Keep your availability current so requests match your real
          schedule.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/worker/media" className="btn-outline">
            Add photos
          </Link>
          <Link href="/worker/services" className="btn-outline">
            Edit services
          </Link>
          <Link href={`/workers/${worker.slug}`} className="btn-ghost">
            View public profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
