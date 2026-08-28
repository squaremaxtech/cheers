import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import EmptyState from "@/components/ui/EmptyState";
import WorkerCard from "@/components/workers/WorkerCard";
import { getUserRow } from "@/lib/auth";
import { viewerPremium } from "@/lib/premium";
import { getFavoriteWorkers } from "@/lib/workers";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  // getFavoriteWorkers does the visibility work: a saved professional who
  // since went hidden or suspended drops off, and so does one whose live
  // services are all premium when this viewer cannot see premium. Someone
  // with no live services at all still shows — they are setting up.
  const saved = await getFavoriteWorkers(user.id, viewerPremium(user));

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Favorites</h1>
      {saved.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No favorites yet"
            hint="Tap the heart on any profile to save them here."
            action={
              <Link href="/browse" className="btn-primary">
                Browse gigs
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((w) => (
            <WorkerCard key={w.id} worker={w} />
          ))}
        </div>
      )}
    </div>
  );
}
