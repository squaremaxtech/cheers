import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { favorites, workers } from "@/db/schema";
import EmptyState from "@/components/ui/EmptyState";
import WorkerCard from "@/components/workers/WorkerCard";
import { getUserRow } from "@/lib/auth";
import {
  attachPrimaryPhotos,
  publicWorkerColumns,
  publicWorkerConditions,
} from "@/lib/workers";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  const saved = await db
    .select({ workerId: favorites.workerId })
    .from(favorites)
    .where(eq(favorites.customerId, user.id))
    .orderBy(desc(favorites.createdAt));

  // Favorited workers who since lost public visibility (pending approval,
  // hidden, suspended) drop off the list rather than dead-ending.
  const rows =
    saved.length > 0
      ? await db
          .select(publicWorkerColumns)
          .from(workers)
          .where(
            and(
              inArray(workers.id, saved.map((s) => s.workerId)),
              ...publicWorkerConditions()
            )
          )
      : [];
  const withPhotos = await attachPrimaryPhotos(rows);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Favorites</h1>
      {withPhotos.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No favorites yet"
            hint="Tap the heart on any profile — or swipe right in browse — to save them here."
            action={
              <Link href="/browse?view=swipe" className="btn-gold">
                Start swiping
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {withPhotos.map((w) => (
            <WorkerCard key={w.id} worker={w} />
          ))}
        </div>
      )}
    </div>
  );
}
