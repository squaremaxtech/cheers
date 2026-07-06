import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { getUserRow } from "@/lib/auth";
import { formatCents } from "@/lib/constants";
import { statusTone } from "@/lib/status";

export const metadata: Metadata = { title: "Booking History" };

export default async function BookingsPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  const rows = await db
    .select({
      booking: bookings,
      stageName: workers.stageName,
    })
    .from(bookings)
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(eq(bookings.customerId, user.id))
    .orderBy(desc(bookings.createdAt));

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Booking history</h1>
      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No bookings yet"
            hint="Find someone extraordinary and make your first booking."
            action={
              <Link href="/browse" className="btn-gold">
                Browse workers
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map(({ booking, stageName }) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="card flex flex-wrap items-center justify-between gap-3 p-5 transition-colors hover:border-gold/40"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {booking.serviceName}{" "}
                  <span className="text-muted">with {stageName}</span>
                </p>
                <p className="mt-1 text-xs text-faint">
                  {booking.code} · {booking.date} at{" "}
                  {booking.startTime.slice(0, 5)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gold">
                  {formatCents(
                    booking.priceCents + booking.addonsCents + booking.tipCents
                  )}
                </span>
                <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
