import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { workerMedia, workers } from "@/db/schema";
import type { PublicWorker, PublicWorkerWithPhoto } from "@/types";

// The ONLY columns public queries may select. realName/userId stay private.
export const publicWorkerColumns = {
  id: workers.id,
  stageName: workers.stageName,
  slug: workers.slug,
  bio: workers.bio,
  age: workers.age,
  heightCm: workers.heightCm,
  bodyType: workers.bodyType,
  languages: workers.languages,
  parish: workers.parish,
  city: workers.city,
  baseRateCents: workers.baseRateCents,
  avgRating: workers.avgRating,
  reviewCount: workers.reviewCount,
};

// A worker the public may see, book or message: admin-approved (verified),
// switched on by the worker (active), and not suspended. New profiles start
// unverified and stay OFF the site until staff green-lights them — every
// public-facing worker query must include these conditions.
export function publicWorkerConditions(): SQL[] {
  return [
    eq(workers.verified, true),
    eq(workers.active, true),
    eq(workers.suspended, false),
  ];
}

// Worker cards for surfaces that list PEOPLE rather than gigs (home
// featured, favorites). Browse itself is gig-centric — see lib/gigs.ts.
export async function getPublicWorkers(opts?: {
  limit?: number;
}): Promise<PublicWorkerWithPhoto[]> {
  const rows = await db
    .select(publicWorkerColumns)
    .from(workers)
    .where(and(...publicWorkerConditions()))
    .orderBy(desc(workers.avgRating), asc(workers.stageName))
    .limit(opts?.limit ?? 60);
  return attachPrimaryPhotos(rows);
}

export async function attachPrimaryPhotos(
  rows: PublicWorker[]
): Promise<PublicWorkerWithPhoto[]> {
  if (rows.length === 0) return [];
  const media = await db
    .select({
      workerId: workerMedia.workerId,
      url: workerMedia.url,
      sortOrder: workerMedia.sortOrder,
    })
    .from(workerMedia)
    .where(
      and(
        inArray(workerMedia.workerId, rows.map((r) => r.id)),
        eq(workerMedia.type, "photo")
      )
    )
    .orderBy(asc(workerMedia.sortOrder));

  const firstPhoto = new Map<string, string>();
  for (const m of media) {
    if (!firstPhoto.has(m.workerId)) firstPhoto.set(m.workerId, m.url);
  }
  return rows.map((w) => ({ ...w, photoUrl: firstPhoto.get(w.id) ?? null }));
}
