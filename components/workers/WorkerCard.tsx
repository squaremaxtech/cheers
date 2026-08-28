import Link from "next/link";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import { formatCents } from "@/lib/constants";
import type { PublicWorkerWithPhoto } from "@/types";

// One professional as a card (home "featured", /favorites). The optional
// "Verified ID" badge is the denormalised users.id_verified_at flag carried
// on PublicWorker — never the account id behind it.
export default function WorkerCard({
  worker,
  layout = "grid",
}: {
  worker: PublicWorkerWithPhoto;
  layout?: "grid" | "list";
}) {
  const location = [worker.city, worker.parish].filter(Boolean).join(", ");
  const isList = layout === "list";

  return (
    <Link
      href={`/workers/${worker.slug}`}
      className={`card group overflow-hidden transition-colors hover:border-brand/40 ${
        isList ? "flex items-stretch" : "block"
      }`}
    >
      <div
        className={`relative overflow-hidden bg-raised ${
          isList ? "w-32 shrink-0 sm:w-44" : "aspect-[4/5]"
        }`}
      >
        {worker.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- media URLs are external/user-provided
          <img
            src={worker.photoUrl}
            alt={worker.stageName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-32 w-full items-center justify-center font-display text-4xl text-hairline">
            {worker.stageName.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg text-ink">{worker.stageName}</h3>
        {worker.headline && (
          <p className="line-clamp-2 text-xs text-muted">{worker.headline}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <StarRating
            avgRatingX100={worker.avgRating}
            reviewCount={worker.reviewCount}
          />
          {worker.idVerified && <Badge tone="success">Verified ID</Badge>}
        </div>
        {location && <p className="text-xs text-muted">{location}</p>}
        {isList && worker.bio && (
          <p className="line-clamp-2 text-sm text-muted">{worker.bio}</p>
        )}
        <p className="mt-auto pt-1 text-sm text-gold-deep">
          from {formatCents(worker.baseRateCents)}
        </p>
      </div>
    </Link>
  );
}
