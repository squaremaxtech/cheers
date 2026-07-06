import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workerMedia } from "@/db/schema";
import MediaManager from "@/components/worker/MediaManager";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Media Manager" };

export default async function WorkerMediaPage() {
  const { worker } = await getWorkerContext();
  const media = await db
    .select()
    .from(workerMedia)
    .where(eq(workerMedia.workerId, worker.id))
    .orderBy(asc(workerMedia.sortOrder));

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Media</h1>
      <p className="mt-1 text-sm text-muted">
        Add photos and videos by URL — the first photo becomes your cover.
      </p>
      <div className="mt-6">
        <MediaManager media={media} />
      </div>
    </div>
  );
}
