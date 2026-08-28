import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookingDrivers, bookings, rides, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import DriverRideControls from "@/components/rides/DriverRideControls";
import {
  formatJamaicaDateTime,
  rideStatusTone,
} from "@/components/rides/rideUi";
import { getUserRow } from "@/lib/auth";
import {
  formatCents,
  formatTime12,
  jamaicaTodayISO,
  rideStatusLabel,
} from "@/lib/constants";
import { driverForUser } from "@/lib/drivers";
import type { RideRow } from "@/types";

export const metadata: Metadata = { title: "My Rides — Driver" };

function RideRowCard({ ride, withControls }: { ride: RideRow; withControls: boolean }) {
  return (
    <div className="card space-y-3 p-5">
      <Link href={`/rides/${ride.id}`} className="block hover:text-brand-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">
            {ride.pickupAddress}
            <span className="mx-2 text-faint">→</span>
            {ride.dropoffAddress}
          </p>
          <Badge tone={rideStatusTone(ride.status)}>
            {rideStatusLabel(ride.status)}
          </Badge>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="text-faint">{ride.code}</span>
          <span className="text-gold-deep">
            {formatCents(ride.finalFareCents ?? ride.offerCents)} cash
          </span>
          <span>
            {ride.scheduledAt
              ? `Pickup ${formatJamaicaDateTime(ride.scheduledAt)}`
              : `Posted ${formatJamaicaDateTime(ride.createdAt)}`}
          </span>
        </p>
      </Link>
      {withControls && (
        <DriverRideControls rideId={ride.id} status={ride.status} />
      )}
    </div>
  );
}

// The driver's matched trips: live ones (with lifecycle controls) and the
// history below. Open board requests live on /driver/requests.
export default async function DriverRidesPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  const driver = await driverForUser(user.id);
  if (!driver) redirect("/driver");

  const rows = await db
    .select()
    .from(rides)
    .where(eq(rides.driverId, driver.id))
    .orderBy(desc(rides.updatedAt))
    .limit(80);

  // Platform transport dispatch: bookings the safety desk assigned this
  // driver to (booking_drivers) — separate from marketplace rides. The
  // assignment is also what grants access to those booking rooms.
  const assignments = await db
    .select({
      bookingId: bookings.id,
      code: bookings.code,
      date: bookings.date,
      startTime: bookings.startTime,
      durationMinutes: bookings.durationMinutes,
      address: bookings.address,
      status: bookings.status,
      stageName: workers.stageName,
    })
    .from(bookingDrivers)
    .innerJoin(bookings, eq(bookingDrivers.bookingId, bookings.id))
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(
      and(
        eq(bookingDrivers.driverUserId, user.id),
        gte(bookings.date, jamaicaTodayISO()),
        inArray(bookings.status, ["confirmed", "in_progress"])
      )
    )
    .orderBy(asc(bookings.date), asc(bookings.startTime));

  const live = rows.filter(
    (r) =>
      r.status === "accepted" ||
      r.status === "arriving" ||
      r.status === "picked_up"
  );
  const past = rows.filter(
    (r) =>
      r.status === "completed" ||
      r.status === "cancelled" ||
      r.status === "expired"
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">My rides</h1>
          <p className="mt-1 text-sm text-muted">
            Trips riders have locked in with you.
          </p>
        </div>
        <Link href="/driver/requests" className="btn-outline">
          Open request board
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Up next
        </h2>
        {live.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No matched rides"
              hint="Accept a request (or have a rider accept your offer) and it lands here."
              action={
                <Link href="/driver/requests" className="btn-primary">
                  Browse open requests
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {live.map((r) => (
              <RideRowCard key={r.id} ride={r} withControls />
            ))}
          </div>
        )}
      </section>

      {assignments.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Transport assignments
          </h2>
          <p className="mt-1 text-xs text-faint">
            Bookings the Cheers team asked you to drive for. Open one for the
            route and live details.
          </p>
          <div className="mt-4 space-y-3">
            {assignments.map((a) => (
              <Link
                key={a.bookingId}
                href={`/bookings/${a.bookingId}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-5 transition-colors hover:border-brand/40"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {a.stageName}
                    <span className="mx-2 text-faint">→</span>
                    {a.address}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    {a.code} · {a.date} at {formatTime12(a.startTime)} (
                    {a.durationMinutes} min)
                  </p>
                </div>
                <Badge tone={a.status === "in_progress" ? "gold" : "success"}>
                  {a.status === "in_progress" ? "In progress" : "Confirmed"}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            History
          </h2>
          <div className="mt-4 space-y-3">
            {past.map((r) => (
              <RideRowCard key={r.id} ride={r} withControls={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
