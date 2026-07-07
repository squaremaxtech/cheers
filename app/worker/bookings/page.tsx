import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import WorkerBookingActions from "@/components/worker/WorkerBookingActions";
import { formatCents, formatTime12 } from "@/lib/constants";
import { statusTone } from "@/lib/status";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Bookings" };

export default async function WorkerBookingsPage() {
  const { worker } = await getWorkerContext();

  const rows = await db
    .select({ booking: bookings, customerName: users.name })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(eq(bookings.workerId, worker.id))
    .orderBy(desc(bookings.createdAt))
    .limit(100);

  const requests = rows.filter((r) => r.booking.status === "pending");
  const upcoming = rows.filter(
    (r) =>
      r.booking.status === "accepted" ||
      r.booking.status === "confirmed" ||
      r.booking.status === "in_progress"
  );
  const past = rows.filter(
    (r) =>
      r.booking.status === "completed" ||
      r.booking.status === "declined" ||
      r.booking.status === "cancelled" ||
      r.booking.status === "refunded"
  );

  function Section({
    title,
    items,
    showActions,
  }: {
    title: string;
    items: typeof rows;
    showActions: boolean;
  }) {
    if (items.length === 0) return null;
    return (
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          {title}
        </h2>
        <div className="mt-3 space-y-3">
          {items.map(({ booking, customerName }) => (
            <div key={booking.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    <Link href={`/bookings/${booking.id}`} className="hover:text-gold-soft">
                      {booking.serviceName}
                    </Link>
                    <span className="ml-2 text-xs text-faint">{booking.code}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {customerName ?? "Customer"} · {booking.date} at{" "}
                    {formatTime12(booking.startTime)} · {booking.durationMinutes} min
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gold">
                    {formatCents(booking.priceCents + booking.addonsCents)}
                  </span>
                  <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
                </div>
              </div>

              {(booking.status === "confirmed" ||
                booking.status === "in_progress") && (
                <p className="mt-3 text-xs text-muted">
                  📍 {booking.address}
                  {booking.instructions && (
                    <span className="mt-1 block text-faint">
                      “{booking.instructions}”
                    </span>
                  )}
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="mt-1 block text-gold"
                  >
                    Open live booking room → (map, PIN start, wellness checks)
                  </Link>
                </p>
              )}

              {showActions && (
                <div className="mt-4">
                  <WorkerBookingActions
                    bookingId={booking.id}
                    status={booking.status}
                    serviceTotalCents={booking.priceCents + booking.addonsCents}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-ink">Bookings</h1>
      {rows.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          hint="When customers request you, they appear here to accept or decline."
        />
      ) : (
        <>
          <Section title={`New requests (${requests.length})`} items={requests} showActions />
          <Section title="Upcoming" items={upcoming} showActions />
          <Section title="History" items={past} showActions={false} />
        </>
      )}
    </div>
  );
}
