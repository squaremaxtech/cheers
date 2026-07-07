import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, users, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import AdminBookingActions from "@/components/admin/AdminBookingActions";
import { formatCents, formatTime12 } from "@/lib/constants";
import { statusTone } from "@/lib/status";

export const metadata: Metadata = { title: "Bookings — Admin" };

export default async function AdminBookingsPage() {
  const [rows, allWorkers] = await Promise.all([
    db
      .select({
        booking: bookings,
        stageName: workers.stageName,
        customerName: users.name,
        customerEmail: users.email,
      })
      .from(bookings)
      .innerJoin(workers, eq(bookings.workerId, workers.id))
      .innerJoin(users, eq(bookings.customerId, users.id))
      .orderBy(desc(bookings.createdAt))
      .limit(200),
    db
      .select({ id: workers.id, stageName: workers.stageName })
      .from(workers)
      .where(eq(workers.suspended, false)),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Bookings</h1>
      <p className="mt-1 text-sm text-muted">
        Override anything: approve, decline, cancel, complete, or reassign.
      </p>

      <div className="mt-6 space-y-3">
        {rows.length === 0 && (
          <p className="card p-6 text-sm text-faint">No bookings yet.</p>
        )}
        {rows.map(({ booking, stageName, customerName, customerEmail }) => (
          <div key={booking.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="hover:text-gold-soft"
                    title="Open live booking room"
                  >
                    {booking.serviceName}
                  </Link>
                  <span className="ml-2 text-xs text-faint">{booking.code}</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {customerName ?? customerEmail} → {stageName} · {booking.date}{" "}
                  at {formatTime12(booking.startTime)}
                </p>
                <p className="mt-0.5 text-xs text-faint">{booking.address}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gold">
                  {formatCents(
                    booking.priceCents + booking.addonsCents + booking.tipCents
                  )}
                </span>
                <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
              </div>
            </div>
            <div className="mt-4">
              <AdminBookingActions
                bookingId={booking.id}
                status={booking.status}
                workers={allWorkers}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
