import Link from "next/link";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import { formatCents } from "@/lib/constants";
import type { GigCard as GigCardData } from "@/types";

// One browse-page card: the gig front and center, with just enough of its
// worker (stage name, rating, parish) to build trust. Links to the worker's
// profile with the gig preselected.
export default function GigCard({ gig }: { gig: GigCardData }) {
  const location = [gig.worker.city, gig.worker.parish]
    .filter(Boolean)
    .join(", ");
  // Quote-mode gigs with no indicative price read as "Custom quote";
  // everything else shows a "From" price.
  const priceLabel =
    gig.pricingMode === "quote" && gig.priceCents === 0
      ? "Custom quote"
      : `From ${formatCents(gig.priceCents)}`;

  return (
    <Link
      href={`/workers/${gig.worker.slug}?gig=${gig.slug}`}
      className="card group block overflow-hidden transition-colors hover:border-gold/40"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-raised">
        {gig.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- media URLs are external/user-provided
          <img
            src={gig.photoUrl}
            alt={gig.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-32 w-full items-center justify-center font-display text-4xl text-hairline">
            {gig.worker.stageName.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <Badge tone="gold">{gig.categoryName}</Badge>
        </div>
        <h3 className="font-display text-lg leading-snug text-ink">
          {gig.title}
        </h3>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-muted">{gig.worker.stageName}</span>
          <StarRating
            avgRatingX100={gig.worker.avgRating}
            reviewCount={gig.worker.reviewCount}
          />
        </div>
        {location && <p className="text-xs text-muted">{location}</p>}
        <p className="mt-auto pt-1 text-sm text-gold">{priceLabel}</p>
      </div>
    </Link>
  );
}
