import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drivers, rideReviews, users } from "@/db/schema";
import StarRating from "@/components/ui/StarRating";
import { getUserRow } from "@/lib/auth";
import { formatCents } from "@/lib/constants";
import {
  publicDriverColumns,
  publicDriverConditions,
  vehicleLabel,
} from "@/lib/drivers";
import { isUuid } from "@/lib/slug";

function driverBySlugOrId(slug: string) {
  return and(
    isUuid(slug) ? eq(drivers.id, slug) : eq(drivers.slug, slug),
    ...publicDriverConditions()
  );
}

export async function generateMetadata(props: PageProps<"/drivers/[slug]">) {
  const { slug } = await props.params;
  const [driver] = await db
    .select({ displayName: drivers.displayName, bio: drivers.bio })
    .from(drivers)
    .where(driverBySlugOrId(slug));
  if (!driver) return { title: "Driver" };
  return {
    title: driver.displayName,
    description:
      driver.bio?.slice(0, 155) ??
      `Ride with ${driver.displayName} on Cheers — name your price, pay cash in the car.`,
  };
}

// A driver's public profile. Only approved+active+unsuspended drivers render
// (everyone else 404s, mirroring workers/[slug]); the plate is NEVER here —
// riders see it in the ride room once matched. Reviews carry riders' FIRST
// names only.
export default async function DriverProfilePage(
  props: PageProps<"/drivers/[slug]">
) {
  const { slug } = await props.params;

  const [driver] = await db
    .select(publicDriverColumns)
    .from(drivers)
    .where(driverBySlugOrId(slug));
  if (!driver) notFound();
  // Old /drivers/<uuid> links redirect to the canonical slug URL.
  if (driver.slug !== slug) redirect(`/drivers/${driver.slug}`);

  const [reviews, viewer] = await Promise.all([
    db
      .select({
        id: rideReviews.id,
        rating: rideReviews.rating,
        body: rideReviews.body,
        createdAt: rideReviews.createdAt,
        riderName: users.name,
      })
      .from(rideReviews)
      .innerJoin(users, eq(rideReviews.riderUserId, users.id))
      .where(
        and(
          eq(rideReviews.driverId, driver.id),
          eq(rideReviews.hidden, false)
        )
      )
      .orderBy(desc(rideReviews.createdAt))
      .limit(20),
    getUserRow(),
  ]);

  const location = [driver.city, driver.parish].filter(Boolean).join(", ");
  const requestHref = viewer ? "/rides/new" : "/login";

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Left: photos + bio + reviews */}
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route */}
              <img
                src={driver.facePhotoUrl}
                alt={driver.displayName}
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
            <div className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route */}
              <img
                src={driver.vehiclePhotoUrl}
                alt={`${driver.vehicleMake} ${driver.vehicleModel}`}
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl text-ink">
              {driver.displayName}
            </h1>
            <StarRating
              avgRatingX100={driver.avgRating}
              reviewCount={driver.reviewCount}
            />
          </div>

          {driver.bio && (
            <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-7 text-muted">
              {driver.bio}
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="card px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-faint">
                Vehicle
              </dt>
              <dd className="mt-1 text-sm text-ink">{vehicleLabel(driver)}</dd>
            </div>
            {location && (
              <div className="card px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-faint">
                  Based in
                </dt>
                <dd className="mt-1 text-sm text-ink">{location}</dd>
              </div>
            )}
            {driver.perKmRateCents > 0 && (
              <div className="card px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-faint">
                  Per km
                </dt>
                <dd className="mt-1 text-sm text-ink">
                  {formatCents(driver.perKmRateCents)}
                </dd>
              </div>
            )}
            {driver.minFareCents > 0 && (
              <div className="card px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-faint">
                  Minimum fare
                </dt>
                <dd className="mt-1 text-sm text-ink">
                  {formatCents(driver.minFareCents)}
                </dd>
              </div>
            )}
          </dl>

          {/* Reviews — riders' first names only, never emails */}
          <section className="mt-12">
            <h2 className="font-display text-xl text-ink">Rider reviews</h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-faint">No reviews yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="card p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-ink">
                        {r.riderName?.split(" ")[0] ?? "Rider"}
                      </p>
                      <span className="text-sm text-gold-deep">
                        {"★".repeat(r.rating)}
                        <span className="text-hairline">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </span>
                    </div>
                    {r.body && (
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {r.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: request panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="text-sm text-muted">Rides with {driver.displayName}</p>
            <p className="font-display mt-1 text-2xl text-gold-deep">
              You name the price
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Post your route with your offer — {driver.displayName} and every
              other verified driver can accept it or counter. Fares are cash,
              paid in the car.
            </p>
            {(driver.perKmRateCents > 0 || driver.minFareCents > 0) && (
              <p className="mt-3 text-xs text-faint">
                Guide rates:{" "}
                {driver.perKmRateCents > 0 &&
                  `${formatCents(driver.perKmRateCents)}/km`}
                {driver.perKmRateCents > 0 && driver.minFareCents > 0 && " · "}
                {driver.minFareCents > 0 &&
                  `minimum ${formatCents(driver.minFareCents)}`}
              </p>
            )}
            <Link href={requestHref} className="btn-primary mt-6 w-full">
              {viewer ? "Request a ride" : "Sign in to request a ride"}
            </Link>
            <p className="mt-3 text-center text-[11px] text-faint">
              Verified ID &amp; licence · Plate check before boarding · Cash
              fares
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
