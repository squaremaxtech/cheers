"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { addFavorite } from "@/actions/favorites";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import { formatCents } from "@/lib/constants";
import type { PublicWorkerWithPhoto } from "@/types";

// Swipe left = skip, swipe right = interested (saves to favorites).
export default function SwipeDeck({
  workers,
}: {
  workers: PublicWorkerWithPhoto[];
}) {
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);

  const current = workers[index];

  async function decide(interested: boolean) {
    if (!current) return;
    setDx(0);
    setIndex((i) => i + 1);
    if (interested) {
      const res = await addFavorite(current.id);
      if (res.ok) {
        toast.success(`${current.stageName} saved to favorites`);
      } else {
        toast.error(res.error);
      }
    }
  }

  if (!current) {
    return (
      <div className="card mx-auto max-w-sm p-10 text-center">
        <p className="font-display text-lg text-ink">That&apos;s everyone</p>
        <p className="mt-2 text-sm text-muted">
          Check your favorites or adjust the filters to see more.
        </p>
        <Link href="/favorites" className="btn-gold mt-6">
          View favorites
        </Link>
      </div>
    );
  }

  const location = [current.city, current.parish].filter(Boolean).join(", ");

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-5">
      <div
        className="card relative w-full touch-pan-y select-none overflow-hidden"
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 25}deg)`,
          transition: dx === 0 ? "transform 0.25s ease" : "none",
        }}
        onPointerDown={(e) => {
          startX.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (startX.current !== null) setDx(e.clientX - startX.current);
        }}
        onPointerUp={() => {
          startX.current = null;
          if (dx > 90) decide(true);
          else if (dx < -90) decide(false);
          else setDx(0);
        }}
      >
        <div className="relative aspect-[4/5] bg-raised">
          {current.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-provided media URL
            <img
              src={current.photoUrl}
              alt={current.stageName}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-6xl text-hairline">
              {current.stageName.charAt(0)}
            </div>
          )}
          {dx > 40 && (
            <span className="absolute left-4 top-4 rounded-lg border-2 border-success px-3 py-1 text-sm font-bold text-success">
              INTERESTED
            </span>
          )}
          {dx < -40 && (
            <span className="absolute right-4 top-4 rounded-lg border-2 border-danger px-3 py-1 text-sm font-bold text-danger">
              SKIP
            </span>
          )}
        </div>
        <div className="space-y-2 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-ink">
              {current.stageName}
              {current.age !== null && (
                <span className="ml-2 text-base text-muted">{current.age}</span>
              )}
            </h3>
            {current.verified && <Badge tone="gold">Verified</Badge>}
          </div>
          <StarRating
            avgRatingX100={current.avgRating}
            reviewCount={current.reviewCount}
          />
          {location && <p className="text-xs text-muted">{location}</p>}
          <p className="text-sm text-gold">
            from {formatCents(current.baseRateCents)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => decide(false)}
          className="btn h-14 w-14 rounded-full border border-danger/40 text-xl text-danger hover:bg-danger/10"
          aria-label="Skip"
        >
          ✕
        </button>
        <Link
          href={`/workers/${current.slug}`}
          className="btn-outline rounded-full px-6"
        >
          View profile
        </Link>
        <button
          type="button"
          onClick={() => decide(true)}
          className="btn h-14 w-14 rounded-full border border-success/40 text-xl text-success hover:bg-success/10"
          aria-label="Interested"
        >
          ♥
        </button>
      </div>
      <p className="text-xs text-faint">
        {index + 1} of {workers.length}
      </p>
    </div>
  );
}
