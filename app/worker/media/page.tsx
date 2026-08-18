import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigs, workerMedia } from "@/db/schema";
import MediaManager from "@/components/worker/MediaManager";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Media Manager" };

export default async function WorkerMediaPage() {
  const { worker } = await getWorkerContext();
  const [media, myGigs] = await Promise.all([
    db
      .select()
      .from(workerMedia)
      .where(eq(workerMedia.workerId, worker.id))
      .orderBy(asc(workerMedia.sortOrder)),
    db
      .select({ id: gigs.id, title: gigs.title })
      .from(gigs)
      .where(eq(gigs.workerId, worker.id))
      .orderBy(asc(gigs.sortOrder), asc(gigs.createdAt)),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Media</h1>
      <p className="mt-1 text-sm text-muted">
        Add photos and videos — the first photo becomes your cover. Tag items
        to a gig so they show on that gig&apos;s page; untagged media shows
        everywhere.
      </p>
      <div className="mt-6">
        <MediaManager media={media} gigs={myGigs} />
      </div>
    </div>
  );
}
