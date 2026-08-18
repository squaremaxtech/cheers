import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { gigAddons, gigCategories, gigs, workerMedia, workers } from "@/db/schema";
import { publicWorkerConditions } from "@/lib/workers";
import type {
  BrowseFilters,
  GigAddonRow,
  GigCard,
  GigCategoryRow,
  PublicGig,
} from "@/types";

// A gig the public may see and book: switched on by its worker, not taken
// down by an admin, and belonging to a publicly visible (approved) worker.
// Every public-facing gig query must compose these WITH
// publicWorkerConditions() on the joined worker.
export function publicGigConditions(): SQL[] {
  return [eq(gigs.active, true), eq(gigs.suspended, false)];
}

const publicGigColumns = {
  id: gigs.id,
  slug: gigs.slug,
  title: gigs.title,
  tags: gigs.tags,
  description: gigs.description,
  pricingMode: gigs.pricingMode,
  priceCents: gigs.priceCents,
  durationMinutes: gigs.durationMinutes,
  categorySlug: gigCategories.slug,
  categoryName: gigCategories.name,
};

export async function getGigCategories(): Promise<GigCategoryRow[]> {
  return db
    .select()
    .from(gigCategories)
    .where(eq(gigCategories.active, true))
    .orderBy(asc(gigCategories.sortOrder), asc(gigCategories.name));
}

// The browse page: gig cards with just enough worker context to render.
export async function getGigCards(filters: BrowseFilters): Promise<GigCard[]> {
  const conditions: SQL[] = [
    ...publicGigConditions(),
    ...publicWorkerConditions(),
  ];

  if (filters.category) {
    conditions.push(eq(gigCategories.slug, filters.category));
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    const match = or(
      ilike(gigs.title, term),
      ilike(workers.stageName, term),
      // tags is text[]: true when any tag ILIKE the term.
      sql`EXISTS (SELECT 1 FROM unnest(${gigs.tags}) AS t WHERE t ILIKE ${term})`
    );
    if (match) conditions.push(match);
  }
  if (filters.parish) conditions.push(eq(workers.parish, filters.parish));
  if (filters.maxPriceCents) {
    conditions.push(lte(gigs.priceCents, filters.maxPriceCents));
  }
  if (filters.minRatingX100) {
    conditions.push(
      sql`${workers.avgRating} >= ${filters.minRatingX100}`
    );
  }

  const rows = await db
    .select({
      ...publicGigColumns,
      workerId: workers.id,
      stageName: workers.stageName,
      workerSlug: workers.slug,
      parish: workers.parish,
      city: workers.city,
      avgRating: workers.avgRating,
      reviewCount: workers.reviewCount,
      languages: workers.languages,
    })
    .from(gigs)
    .innerJoin(workers, eq(gigs.workerId, workers.id))
    .innerJoin(gigCategories, eq(gigs.categoryId, gigCategories.id))
    .where(and(...conditions))
    .orderBy(desc(workers.avgRating), asc(gigs.title))
    .limit(60);

  // Language filter is an array column — filter in JS to keep the query simple.
  const filtered = filters.language
    ? rows.filter((r) => r.languages.some((l) => l === filters.language))
    : rows;

  const photos = await gigPhotoMap(
    filtered.map((r) => ({ gigId: r.id, workerId: r.workerId }))
  );

  return filtered.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tags: r.tags,
    description: r.description,
    pricingMode: r.pricingMode,
    priceCents: r.priceCents,
    durationMinutes: r.durationMinutes,
    categorySlug: r.categorySlug,
    categoryName: r.categoryName,
    photoUrl: photos.get(r.id) ?? null,
    worker: {
      id: r.workerId,
      stageName: r.stageName,
      slug: r.workerSlug,
      parish: r.parish,
      city: r.city,
      avgRating: r.avgRating,
      reviewCount: r.reviewCount,
    },
  }));
}

// Cover photo per gig: the gig's own first tagged photo, else the worker's
// first untagged photo (untagged media shows everywhere by design).
async function gigPhotoMap(
  pairs: { gigId: string; workerId: string }[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (pairs.length === 0) return result;
  const workerIds = [...new Set(pairs.map((p) => p.workerId))];
  const media = await db
    .select({
      workerId: workerMedia.workerId,
      gigId: workerMedia.gigId,
      url: workerMedia.url,
    })
    .from(workerMedia)
    .where(
      and(
        inArray(workerMedia.workerId, workerIds),
        eq(workerMedia.type, "photo")
      )
    )
    .orderBy(asc(workerMedia.sortOrder));

  const firstTagged = new Map<string, string>();
  const firstUntagged = new Map<string, string>();
  for (const m of media) {
    if (m.gigId) {
      if (!firstTagged.has(m.gigId)) firstTagged.set(m.gigId, m.url);
    } else if (!firstUntagged.has(m.workerId)) {
      firstUntagged.set(m.workerId, m.url);
    }
  }
  for (const p of pairs) {
    const url = firstTagged.get(p.gigId) ?? firstUntagged.get(p.workerId);
    if (url) result.set(p.gigId, url);
  }
  return result;
}

export type PublicGigWithAddons = PublicGig & {
  addons: Pick<GigAddonRow, "id" | "name" | "priceCents" | "description">[];
};

// A worker's live gigs for their public profile (with add-ons).
export async function getPublicWorkerGigs(
  workerId: string
): Promise<PublicGigWithAddons[]> {
  const rows = await db
    .select(publicGigColumns)
    .from(gigs)
    .innerJoin(gigCategories, eq(gigs.categoryId, gigCategories.id))
    .where(and(eq(gigs.workerId, workerId), ...publicGigConditions()))
    .orderBy(asc(gigs.sortOrder), asc(gigs.createdAt));
  if (rows.length === 0) return [];

  const addons = await db
    .select({
      id: gigAddons.id,
      gigId: gigAddons.gigId,
      name: gigAddons.name,
      priceCents: gigAddons.priceCents,
      description: gigAddons.description,
    })
    .from(gigAddons)
    .where(
      inArray(
        gigAddons.gigId,
        rows.map((r) => r.id)
      )
    );

  return rows.map((r) => ({
    ...r,
    addons: addons
      .filter((a) => a.gigId === r.id)
      .map((a) => ({
        id: a.id,
        name: a.name,
        priceCents: a.priceCents,
        description: a.description,
      })),
  }));
}

// The gallery for one gig: its tagged media plus the worker's untagged pool.
export async function getGigMedia(workerId: string, gigId: string) {
  return db
    .select({
      id: workerMedia.id,
      type: workerMedia.type,
      url: workerMedia.url,
      gigId: workerMedia.gigId,
    })
    .from(workerMedia)
    .where(
      and(
        eq(workerMedia.workerId, workerId),
        or(eq(workerMedia.gigId, gigId), isNull(workerMedia.gigId))
      )
    )
    .orderBy(asc(workerMedia.sortOrder));
}

// Keeps workers.baseRateCents (the browse "from" price) honest: the cheapest
// live fixed-price gig, else the cheapest live gig of any kind, else 0.
// Called by the gig actions after every change.
export async function syncWorkerBaseRate(workerId: string): Promise<void> {
  const rows = await db
    .select({ priceCents: gigs.priceCents, pricingMode: gigs.pricingMode })
    .from(gigs)
    .where(and(eq(gigs.workerId, workerId), ...publicGigConditions()));
  const priced = rows.filter(
    (r) => r.pricingMode === "fixed" && r.priceCents > 0
  );
  const pool = priced.length > 0 ? priced : rows.filter((r) => r.priceCents > 0);
  const min = pool.length > 0 ? Math.min(...pool.map((r) => r.priceCents)) : 0;
  await db
    .update(workers)
    .set({ baseRateCents: min, updatedAt: new Date() })
    .where(eq(workers.id, workerId));
}
