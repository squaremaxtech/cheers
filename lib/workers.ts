import { and, asc, desc, eq, gte, ilike, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  serviceCategories,
  serviceTypes,
  workerMedia,
  workers,
  workerServices,
} from "@/db/schema";
import type {
  BrowseFilters,
  PublicWorker,
  PublicWorkerWithPhoto,
} from "@/types";

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

export async function getPublicWorkers(
  filters: BrowseFilters
): Promise<PublicWorkerWithPhoto[]> {
  const conditions: SQL[] = publicWorkerConditions();

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

  // Service filter: a service CATEGORY slug — workers with any enabled
  // service in that category match.
  if (filters.service) {
    const offering = await db
      .select({ workerId: workerServices.workerId })
      .from(workerServices)
      .innerJoin(serviceTypes, eq(workerServices.serviceTypeId, serviceTypes.id))
      .innerJoin(
        serviceCategories,
        eq(serviceTypes.categoryId, serviceCategories.id)
      )
      .where(
        and(
          eq(serviceCategories.slug, filters.service),
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
    .orderBy(desc(workers.avgRating), asc(workers.stageName))
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
