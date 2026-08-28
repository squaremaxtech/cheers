import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { drivers, rides } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatJamaicaDateTime, rideStatusTone } from "@/components/rides/rideUi";
import { getUserRow } from "@/lib/auth";
import { formatCents, rideStatusLabel } from "@/lib/constants";
import { rideExpired } from "@/lib/rides";

export const metadata: Metadata = { title: "My Rides" };

// The signed-in user's rides AS RIDER (customers and workers alike). Drivers
// live in their own hub — their trips are at /driver/rides.
export default async function MyRidesPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role === "driver") redirect("/driver/rides");

  const rows = await db
    .select({
      ride: rides,
      driverName: drivers.displayName,
    })
    .from(rides)
    .leftJoin(drivers, eq(rides.driverId, drivers.id))
    .where(eq(rides.riderUserId, user.id))
    .orderBy(desc(rides.createdAt))
    .limit(60);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">My rides</h1>
          <p className="mt-1 text-sm text-muted">
            Name your price, pick your driver, pay cash in the car.
          </p>
        </div>
        <Link href="/rides/new" className="btn-primary">
          Request a ride
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No rides yet"
            hint="Post your route and your price — nearby drivers accept it or counter with their own."
            action={
              <Link href="/rides/new" className="btn-primary">
                Request your first ride
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {rows.map(({ ride, driverName }) => {
            const status = rideExpired(ride) ? "expired" : ride.status;
            const fare = ride.finalFareCents ?? ride.offerCents;
            return (
              <Link
                key={ride.id}
                href={`/rides/${ride.id}`}
                className="card block p-5 transition-colors hover:border-brand/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {ride.pickupAddress}
                    <span className="mx-2 text-faint">→</span>
                    {ride.dropoffAddress}
                  </p>
                  <Badge tone={rideStatusTone(status)}>
                    {rideStatusLabel(status)}
                  </Badge>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="text-faint">{ride.code}</span>
                  <span className="text-gold-deep">
                    {formatCents(fare)}
                    {ride.finalFareCents === null && " offered"}
                  </span>
                  <span>
                    {ride.scheduledAt
                      ? `Pickup ${formatJamaicaDateTime(ride.scheduledAt)}`
                      : `Posted ${formatJamaicaDateTime(ride.createdAt)}`}
                  </span>
                  {driverName && <span>with {driverName}</span>}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
