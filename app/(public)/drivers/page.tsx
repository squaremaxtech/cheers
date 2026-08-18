import Link from "next/link";
import type { Metadata } from "next";
import StarRating from "@/components/ui/StarRating";
import EmptyState from "@/components/ui/EmptyState";
import { formatCents, JAMAICA_PARISHES } from "@/lib/constants";
import { getPublicDrivers, vehicleLabel } from "@/lib/drivers";
import type { DriverBrowseFilters } from "@/types";

export const metadata: Metadata = {
  title: "Drivers",
  description:
    "Verified drivers across Jamaica. Name your price for any route — drivers accept or counter, and you pay cash in the car.",
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// The public driver directory: approved, active, unsuspended drivers only
// (publicDriverConditions) — and NEVER a plate: riders get that in the ride
// room once matched.
export default async function DriversPage(props: PageProps<"/drivers">) {
  const params = await props.searchParams;
  const q = firstParam(params.q);
  const parish = firstParam(params.parish);
  const minRating = Number(firstParam(params.minRating)) || undefined;

  const filters: DriverBrowseFilters = {
    q,
    parish,
    minRatingX100: minRating ? minRating * 100 : undefined,
  };
  const results = await getPublicDrivers(filters);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Drivers</h1>
          <p className="mt-1 text-sm text-muted">
            {results.length} verified driver{results.length === 1 ? "" : "s"}{" "}
            across Jamaica — name your price, they accept or counter.
          </p>
        </div>
        <Link href="/rides/new" className="btn-gold">
          Request a ride
        </Link>
      </div>

      {/* Filters — plain GET form, shareable URLs */}
      <form
        method="get"
        className="card mt-6 flex flex-wrap items-end gap-3 p-4"
      >
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="drv-q">
            Search
          </label>
          <input
            id="drv-q"
            name="q"
            className="input"
            placeholder="Name, make or model…"
            defaultValue={q ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="drv-parish">
            Parish
          </label>
          <select
            id="drv-parish"
            name="parish"
            className="input"
            defaultValue={parish ?? ""}
          >
            <option value="">All parishes</option>
            {JAMAICA_PARISHES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="drv-rating">
            Rating
          </label>
          <select
            id="drv-rating"
            name="minRating"
            className="input"
            defaultValue={minRating ? String(minRating) : ""}
          >
            <option value="">Any</option>
            <option value="3">3★ and up</option>
            <option value="4">4★ and up</option>
            <option value="5">5★ only</option>
          </select>
        </div>
        <button type="submit" className="btn-outline">
          Apply
        </button>
      </form>

      {results.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No drivers match"
            hint="Try widening the filters — or post a ride request anyway: every approved driver sees it, whatever their parish."
            action={
              <Link href="/rides/new" className="btn-gold">
                Request a ride
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((d) => {
            const location = [d.city, d.parish].filter(Boolean).join(", ");
            return (
              <Link
                key={d.id}
                href={`/drivers/${d.slug}`}
                className="card group block overflow-hidden transition-colors hover:border-gold/40"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-raised">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route */}
                  <img
                    src={d.facePhotoUrl}
                    alt={d.displayName}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col gap-1.5 p-4">
                  <h2 className="font-display text-lg text-ink">
                    {d.displayName}
                  </h2>
                  <StarRating
                    avgRatingX100={d.avgRating}
                    reviewCount={d.reviewCount}
                  />
                  <p className="text-xs text-muted">{vehicleLabel(d)}</p>
                  {location && <p className="text-xs text-faint">{location}</p>}
                  {(d.perKmRateCents > 0 || d.minFareCents > 0) && (
                    <p className="mt-1 text-sm text-gold">
                      {d.perKmRateCents > 0 &&
                        `${formatCents(d.perKmRateCents)}/km`}
                      {d.perKmRateCents > 0 && d.minFareCents > 0 && " · "}
                      {d.minFareCents > 0 &&
                        `min ${formatCents(d.minFareCents)}`}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
