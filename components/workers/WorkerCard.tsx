import Link from "next/link";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import { formatCents } from "@/lib/constants";
import type { PublicWorkerWithPhoto } from "@/types";

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
      className={`card group overflow-hidden transition-colors hover:border-gold/40 ${
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg text-ink">{worker.stageName}</h3>
          {worker.verified && <Badge tone="gold">Verified</Badge>}
        </div>
        <div className="flex items-center justify-between text-sm">
          <StarRating
            avgRatingX100={worker.avgRating}
            reviewCount={worker.reviewCount}
          />
          {worker.age !== null && <span className="text-faint">{worker.age}</span>}
        </div>
        {location && <p className="text-xs text-muted">{location}</p>}
        {isList && worker.bio && (
          <p className="line-clamp-2 text-sm text-muted">{worker.bio}</p>
        )}
        <p className="mt-auto pt-1 text-sm text-gold">
          from {formatCents(worker.baseRateCents)}
        </p>
      </div>
    </Link>
  );
}
