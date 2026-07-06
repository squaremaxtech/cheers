import { and, asc, desc, eq, gte, ilike, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { serviceTypes, workerMedia, workers, workerServices } from "@/db/schema";
import type { PublicWorker } from "@/types";

// The ONLY columns public queries may select. realName/userId stay private.
export const publicWorkerColumns = {
  id: workers.id,
  stageName: workers.stageName,
  bio: workers.bio,
  age: workers.age,
  heightCm: workers.heightCm,
  bodyType: workers.bodyType,
  languages: workers.languages,
  parish: workers.parish,
  city: workers.city,
  baseRateCents: workers.baseRateCents,
  verified: workers.verified,
  avgRating: workers.avgRating,
  reviewCount: workers.reviewCount,
};

export type BrowseFilters = {
  q?: string;
  parish?: string;
  service?: string; // service type slug
  minAge?: number;
  maxAge?: number;
  maxPriceCents?: number;
  minRatingX100?: number;
  language?: string;
  verified?: boolean;
};

export type PublicWorkerWithPhoto = PublicWorker & { photoUrl: string | null };

export async function getPublicWorkers(
  filters: BrowseFilters
): Promise<PublicWorkerWithPhoto[]> {
  const conditions: SQL[] = [
    eq(workers.active, true),
    eq(workers.suspended, false),
  ];

  if (filters.q) conditions.push(ilike(workers.stageName, `%${filters.q}%`));
  if (filters.parish) conditions.push(eq(workers.parish, filters.parish));
  if (filters.minAge) conditions.push(gte(workers.age, filters.minAge));
  if (filters.maxAge) conditions.push(lte(workers.age, filters.maxAge));
  if (filters.maxPriceCents) {
    conditions.push(lte(workers.baseRateCents, filters.maxPriceCents));
  }
  if (filters.minRatingX100) {
    conditions.push(gte(workers.avgRating, filters.minRatingX100));
  }
  if (filters.verified) conditions.push(eq(workers.verified, true));

  // Service filter: workers with that service type enabled.
  if (filters.service) {
    const offering = await db
      .select({ workerId: workerServices.workerId })
      .from(workerServices)
      .innerJoin(serviceTypes, eq(workerServices.serviceTypeId, serviceTypes.id))
      .where(
        and(
          eq(serviceTypes.slug, filters.service),
          eq(workerServices.enabled, true)
        )
      );
    const ids = offering.map((o) => o.workerId);
    if (ids.length === 0) return [];
    conditions.push(inArray(workers.id, ids));
  }

  const rows = await db
    .select(publicWorkerColumns)
    .from(workers)
    .where(and(...conditions))
    .orderBy(desc(workers.verified), desc(workers.avgRating), asc(workers.stageName))
    .limit(60);

  // Language filter is an array column — filter in JS to keep the query simple.
  const filtered = filters.language
    ? rows.filter((w) => w.languages.some((l) => l === filters.language))
    : rows;

  return attachPrimaryPhotos(filtered);
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
