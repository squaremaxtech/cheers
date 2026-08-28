import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { drivers, rideEvents, rideOffers, rideReviews, users } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import DriverRideControls from "@/components/rides/DriverRideControls";
import OfferAcceptButton from "@/components/rides/OfferAcceptButton";
import RideCancelButton from "@/components/rides/RideCancelButton";
import RideLive from "@/components/rides/RideLive";
import RideReviewForm from "@/components/rides/RideReviewForm";
import RideRouteMap from "@/components/rides/RideRouteMap";
import { formatJamaicaDateTime, rideStatusTone } from "@/components/rides/rideUi";
import { parseLatLng } from "@/components/maps/mapConfig";
import { getUserRow } from "@/lib/auth";
import { formatCents, rideStatusLabel } from "@/lib/constants";
import { vehicleLabel } from "@/lib/drivers";
import { loadRideAccess } from "@/lib/ride-access";
import { canTransitionRide, rideExpired } from "@/lib/rides";

export const metadata: Metadata = { title: "Ride" };

// The live ride room. One shared URL for the rider, the MATCHED driver and
// staff — realtime offers and lifecycle over SSE. Never rendered to anyone
// else (loadRideAccess), and the driver's plate appears here ONLY, once a
// driver is locked in.
export default async function RideRoomPage(props: PageProps<"/rides/[id]">) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  const { id } = await props.params;

  const access = await loadRideAccess(user, id);
  if (!access) notFound();
  const { ride, viewerRole, driver } = access;

  // An open request past its expiry reads as expired even before any row
  // update (lib/rides.ts).
  const status = rideExpired(ride) ? "expired" : ride.status;
  const terminal =
    status === "completed" || status === "cancelled" || status === "expired";
  const matched = driver !== null && status !== "requested";

  const [events, offers, review, riderRow] = await Promise.all([
    db
      .select()
      .from(rideEvents)
      .where(eq(rideEvents.rideId, ride.id))
      .orderBy(desc(rideEvents.createdAt))
      .limit(30),
    // Open offers only matter while the request is open. Public driver fields
    // only — NO plate until a driver is matched.
    status === "requested"
      ? db
          .select({
            id: rideOffers.id,
            priceCents: rideOffers.priceCents,
            note: rideOffers.note,
            displayName: drivers.displayName,
            facePhotoUrl: drivers.facePhotoUrl,
            avgRating: drivers.avgRating,
            reviewCount: drivers.reviewCount,
            parish: drivers.parish,
            vehicleMake: drivers.vehicleMake,
            vehicleModel: drivers.vehicleModel,
            vehicleYear: drivers.vehicleYear,
            vehicleColor: drivers.vehicleColor,
          })
          .from(rideOffers)
          .innerJoin(drivers, eq(rideOffers.driverId, drivers.id))
          .where(
            and(eq(rideOffers.rideId, ride.id), eq(rideOffers.status, "open"))
          )
          .orderBy(asc(rideOffers.priceCents))
      : Promise.resolve([]),
    status === "completed"
      ? db
          .select({ id: rideReviews.id, rating: rideReviews.rating })
          .from(rideReviews)
          .where(eq(rideReviews.rideId, ride.id))
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    // The rider's FIRST name for the driver/staff view — never the email.
    viewerRole !== "rider"
      ? db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, ride.riderUserId))
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const riderFirstName = riderRow?.name?.split(" ")[0] ?? "Rider";
  const pickupPoint = parseLatLng(ride.pickupLat, ride.pickupLng);
  const dropoffPoint = parseLatLng(ride.dropoffLat, ride.dropoffLng);
  const riderCanCancel =
    viewerRole === "rider" && canTransitionRide(status, "cancelled", false);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Ride {ride.code}</h1>
          <p className="mt-1 text-sm text-muted">
            {ride.scheduledAt
              ? `Pickup ${formatJamaicaDateTime(ride.scheduledAt)}`
              : "As soon as possible"}
            {" · "}
            <span className="uppercase tracking-wider text-faint">
              viewing as {viewerRole}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={rideStatusTone(status)}>{rideStatusLabel(status)}</Badge>
          <RideLive rideId={ride.id} terminal={terminal} />
        </div>
      </div>

      {/* Route */}
      <div className="card space-y-3 p-6 text-sm">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
          Route
        </h2>
        <div className="flex gap-3">
          <span className="mt-1 shrink-0 text-gold-deep">●</span>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-faint">
              Pickup
            </p>
            <p className="text-ink">{ride.pickupAddress}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="mt-1 shrink-0 text-muted">■</span>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-faint">
              Drop-off
            </p>
            <p className="text-ink">{ride.dropoffAddress}</p>
          </div>
        </div>
        {ride.distanceM !== null && (
          <p className="text-xs text-faint">
            About {(ride.distanceM / 1000).toFixed(1)} km
          </p>
        )}
        <RideRouteMap pickup={pickupPoint} dropoff={dropoffPoint} />
      </div>

      {/* Fare & payment */}
      <div className="card space-y-2 p-6 text-sm">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
          Fare
        </h2>
        <div className="flex justify-between">
          <span className="text-muted">
            {viewerRole === "rider" ? "Your asking price" : "Rider's offer"}
          </span>
          <span className="text-ink">{formatCents(ride.offerCents)}</span>
        </div>
        {ride.suggestedFareCents !== null && status === "requested" && (
          <div className="flex justify-between">
            <span className="text-muted">Suggested for this route</span>
            <span className="text-faint">
              {formatCents(ride.suggestedFareCents)}
            </span>
          </div>
        )}
        {ride.finalFareCents !== null && (
          <div className="hairline-top flex justify-between pt-2 text-[1rem]">
            <span className="text-ink">Agreed fare</span>
            <span className="font-medium text-gold-deep">
              {formatCents(ride.finalFareCents)}
            </span>
          </div>
        )}
        <p className="pt-1 text-xs text-faint">
          Cash to the driver — pay when the trip ends. Nothing is charged
          through the app.
        </p>
      </div>

      {/* Open request: the rider compares offers */}
      {status === "requested" && viewerRole !== "driver" && (
        <div className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
              Driver offers
            </h2>
            <p className="text-xs text-faint">
              Open until {formatJamaicaDateTime(ride.expiresAt)}
            </p>
          </div>
          {offers.length === 0 ? (
            <p className="text-sm text-faint">
              No offers yet — drivers see your request the moment it posts.
              A driver can also accept your price instantly, so keep this page
              open.
            </p>
          ) : (
            <ul className="space-y-3">
              {offers.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-hairline p-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route */}
                  <img
                    src={o.facePhotoUrl}
                    alt={o.displayName}
                    className="h-14 w-14 shrink-0 rounded-full border border-hairline object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink">
                        {o.displayName}
                      </p>
                      <StarRating
                        avgRatingX100={o.avgRating}
                        reviewCount={o.reviewCount}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {vehicleLabel(o)}
                      {o.parish && ` · ${o.parish}`}
                    </p>
                    {o.note && (
                      <p className="mt-1 text-xs italic text-faint">
                        “{o.note}”
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-xl text-gold-deep">
                      {formatCents(o.priceCents)}
                    </span>
                    {viewerRole === "rider" && (
                      <OfferAcceptButton rideId={ride.id} offerId={o.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Matched: the driver, with the plate — the rider's boarding check.
          (The driver doesn't need their own card; they get the trip panel.) */}
      {matched && driver && viewerRole !== "driver" && (
        <div className="card space-y-4 border-gold/30 p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gold-deep">
            Your driver
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route */}
            <img
              src={driver.facePhotoUrl}
              alt={driver.displayName}
              className="h-16 w-16 shrink-0 rounded-full border border-hairline object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">
                  {driver.displayName}
                </p>
                <StarRating
                  avgRatingX100={driver.avgRating}
                  reviewCount={driver.reviewCount}
                />
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {vehicleLabel(driver)}
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route */}
            <img
              src={driver.vehiclePhotoUrl}
              alt={`${driver.vehicleMake} ${driver.vehicleModel}`}
              className="h-16 w-24 shrink-0 rounded-xl border border-hairline object-cover"
            />
          </div>
          <div className="rounded-xl border border-warn/50 bg-warn/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-warn">
              Check the plate before you get in
            </p>
            <p className="font-display mt-1 text-2xl tracking-[0.2em] text-ink">
              {driver.vehiclePlate}
            </p>
            <p className="mt-1 text-xs text-muted">
              If the plate or driver doesn&apos;t match this page, don&apos;t
              board.
            </p>
          </div>
        </div>
      )}

      {/* Driver's view of the rider (first name only) + lifecycle controls */}
      {viewerRole === "driver" && !terminal && (
        <div className="card space-y-4 p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
            Your trip
          </h2>
          <p className="text-sm text-muted">
            Riding: <span className="text-ink">{riderFirstName}</span> · collect{" "}
            <span className="text-gold-deep">
              {formatCents(ride.finalFareCents ?? ride.offerCents)}
            </span>{" "}
            in cash at drop-off.
          </p>
          <DriverRideControls rideId={ride.id} status={status} />
        </div>
      )}

      {/* Rider actions */}
      {riderCanCancel && (
        <div className="flex justify-end">
          <RideCancelButton
            rideId={ride.id}
            label={status === "requested" ? "Cancel request" : "Cancel ride"}
          />
        </div>
      )}

      {/* Rating, once complete */}
      {viewerRole === "rider" && status === "completed" && (
        <div className="card p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
            Rate your driver
          </h2>
          <div className="mt-4">
            {review ? (
              <p className="text-sm text-muted">
                You rated this ride{" "}
                <span className="text-gold">{"★".repeat(review.rating)}</span> —
                thanks for the feedback.
              </p>
            ) : (
              <RideReviewForm rideId={ride.id} />
            )}
          </div>
        </div>
      )}

      {viewerRole === "staff" && (
        <p className="text-xs text-faint">
          Staff view — read-only. Ride disputes are handled from{" "}
          <Link href="/admin" className="text-brand hover:text-brand-soft">
            the admin area
          </Link>
          .
        </p>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div className="card p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
            Activity
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-4">
                <span className="text-ink">
                  {e.fromStatus && e.fromStatus !== e.toStatus
                    ? `${rideStatusLabel(e.fromStatus)} → ${rideStatusLabel(e.toStatus)}`
                    : rideStatusLabel(e.toStatus)}
                  {e.note && (
                    <span className="ml-2 text-xs text-faint">{e.note}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-faint">
                  {formatJamaicaDateTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
