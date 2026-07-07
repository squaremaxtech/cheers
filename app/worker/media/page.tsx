import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { serviceCategories, workerMedia } from "@/db/schema";
import MediaManager from "@/components/worker/MediaManager";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Media Manager" };

export default async function WorkerMediaPage() {
  const { worker } = await getWorkerContext();
  const [media, categories] = await Promise.all([
    db
      .select()
      .from(workerMedia)
      .where(eq(workerMedia.workerId, worker.id))
      .orderBy(asc(workerMedia.sortOrder)),
    db
      .select()
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.sortOrder)),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Media</h1>
      <p className="mt-1 text-sm text-muted">
        Add photos and videos — the first photo becomes your cover. Tag items
        to a category so they show alongside that service on your profile.
      </p>
      <div className="mt-6">
        <MediaManager media={media} categories={categories} />
      </div>
    </div>
  );
}
