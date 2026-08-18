import { asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigAddons, gigs } from "@/db/schema";
import GigsEditor from "@/components/worker/GigsEditor";
import { getGigCategories } from "@/lib/gigs";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Gigs" };

export default async function WorkerGigsPage() {
  const { worker } = await getWorkerContext();

  const [categories, mine] = await Promise.all([
    getGigCategories(),
    db
      .select()
      .from(gigs)
      .where(eq(gigs.workerId, worker.id))
      .orderBy(asc(gigs.sortOrder), asc(gigs.createdAt)),
  ]);

  const addons =
    mine.length > 0
      ? await db
          .select()
          .from(gigAddons)
          .where(inArray(gigAddons.gigId, mine.map((g) => g.id)))
      : [];

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Gigs</h1>
      <p className="mt-1 text-sm text-muted">
        Your gigs are what customers browse and book — each with its own
        price, duration, tags and add-ons. Fixed-price gigs are booked
        instantly; quote gigs let customers describe the job so you can send
        the price.
      </p>
      <div className="mt-6">
        <GigsEditor categories={categories} gigs={mine} addons={addons} />
      </div>
    </div>
  );
}
