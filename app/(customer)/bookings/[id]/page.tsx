import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, reviews, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import BookingCustomerActions from "@/components/bookings/BookingCustomerActions";
import ReviewForm from "@/components/bookings/ReviewForm";
import { getUserRow } from "@/lib/auth";
import { customerCanCancel } from "@/lib/bookings";
import { formatCents } from "@/lib/constants";
import { statusTone } from "@/lib/status";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingDetailPage(
  props: PageProps<"/bookings/[id]">
) {
  const user = await getUserRow();
  if (!user) redirect("/login");
  const { id } = await props.params;

  const [row] = await db
    .select({ booking: bookings, stageName: workers.stageName })
    .from(bookings)
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, user.id)));
  if (!row) notFound();
  const { booking, stageName } = row;

  const [existingReview] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.bookingId, booking.id));

  const total = booking.priceCents + booking.addonsCents;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">
            {booking.serviceName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            with{" "}
            <Link href={`/workers/${booking.workerId}`} className="text-gold">
              {stageName}
            </Link>{" "}
            · {booking.code}
          </p>
        </div>
        <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
      </div>

      <div className="card space-y-3 p-6 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Date</span>
          <span className="text-ink">
            {booking.date} at {booking.startTime.slice(0, 5)} ·{" "}
            {booking.durationMinutes} min
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted">Address</span>
          <span className="text-right text-ink">{booking.address}</span>
        </div>
        {booking.instructions && (
          <div className="flex justify-between gap-6">
            <span className="text-muted">Instructions</span>
            <span className="text-right text-ink">{booking.instructions}</span>
          </div>
        )}
        <div className="hairline-top pt-3">
          <div className="flex justify-between">
            <span className="text-muted">Service</span>
            <span className="text-ink">{formatCents(booking.priceCents)}</span>
          </div>
          {booking.addons.map((a) => (
            <div key={a.name} className="flex justify-between">
              <span className="text-muted">{a.name}</span>
              <span className="text-ink">{formatCents(a.priceCents)}</span>
            </div>
          ))}
          {booking.tipCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Tip</span>
              <span className="text-ink">{formatCents(booking.tipCents)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-base">
            <span className="text-ink">Total</span>
            <span className="font-medium text-gold">
              {formatCents(total + booking.tipCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Safety panel: PIN revealed once confirmed */}
      {(booking.status === "confirmed" || booking.status === "in_progress") &&
        booking.safetyPin && (
          <div className="card border-gold/30 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-gold">
              Safety
            </h2>
            <p className="mt-2 text-sm text-muted">
              Share this PIN with {stageName} at the start of your meeting to
              verify identity:
            </p>
            <p className="font-display mt-3 text-3xl tracking-[0.4em] text-ink">
              {booking.safetyPin}
            </p>
            <p className="mt-3 text-xs text-faint">
              Wellness check and live location sharing arrive with our mobile
              app. In an emergency, always call 119.
            </p>
          </div>
        )}

      <BookingCustomerActions
        bookingId={booking.id}
        status={booking.status}
        canCancel={customerCanCancel(booking)}
        serviceTotalCents={total}
        stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
      />

      {booking.status === "completed" && !existingReview && (
        <div className="card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Leave a review
          </h2>
          <div className="mt-4">
            <ReviewForm bookingId={booking.id} />
          </div>
        </div>
      )}
    </div>
  );
}
