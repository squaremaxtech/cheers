import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  gigAddons,
  gigCategories,
  gigs,
  users,
  workerMedia,
  workers,
} from "@/db/schema";
import { PUBLIC_VIEWER } from "@/lib/premium";
import { publicWorkerConditions, publicWorkerUserJoin } from "@/lib/workers";
import type {
  BrowseFilters,
  GigAddonRow,
  GigCard,
  GigCategoryRow,
  PremiumViewer,
  PublicGig,
} from "@/types";

// A gig the public may see and book: switched on by its worker, not taken
// down by an admin, and belonging to a publicly visible worker. Every
// public-facing gig query must compose these WITH publicWorkerConditions()
// on the joined worker.
//
// The PremiumViewer also enforces the premium rail: a viewer who cannot see
// premium gets `gigs.premium = false` appended, so premium listings, their
// media and their prices are unreachable — not merely unbadged.
//
// The viewer is REQUIRED so no caller can fall into a permissive default by
// accident. Pass PUBLIC_VIEWER for anything public or derived from public
// data; pass STAFF_VIEWER only where an explicit `gigs.premium = …` equality
// follows (the job-request rail in lib/jobs.ts).
export function publicGigConditions(viewer: PremiumViewer): SQL[] {
  const conditions: SQL[] = [eq(gigs.active, true), eq(gigs.suspended, false)];
  if (!viewer.canSeePremium) conditions.push(eq(gigs.premium, false));
  return conditions;
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
  premium: gigs.premium,
  categorySlug: gigCategories.slug,
  categoryName: gigCategories.name,
};

// The hidden 15th category. Premium gigs ALWAYS live here and nowhere else:
// actions/gigs.ts forces a premium gig onto it and refuses it to every other
// gig, so "is this gig premium" and "is it in the Premium category" can never
// drift apart. The category is itself part of the premium rail — a viewer who
// cannot see premium must not learn the tier exists, so it is stripped from
// every category list they are shown.
export const PREMIUM_CATEGORY_SLUG = "premium";

// The browse taxonomy for one viewer.
//
// The viewer is OPTIONAL and the default is the safe one: with no viewer (or a
// viewer who cannot see premium) the Premium category is not in the result at
// all. Every existing caller — browse filters, the home page, the job-request
// category picker — passes nothing and is correct by default; only the
// surfaces where premium is legitimately visible (the admin catalog, a premium
// provider's own gig form) pass a viewer that can see it.
export async function getGigCategories(
  viewer?: PremiumViewer
): Promise<GigCategoryRow[]> {
  const conditions: SQL[] = [eq(gigCategories.active, true)];
  if (!viewer?.canSeePremium) {
    conditions.push(ne(gigCategories.slug, PREMIUM_CATEGORY_SLUG));
  }
  return db
    .select()
    .from(gigCategories)
    .where(and(...conditions))
    .orderBy(asc(gigCategories.sortOrder), asc(gigCategories.name));
}

// The Premium category id, or null when the row is missing (a database seeded
// before this taxonomy). Callers treat null as "premium listings are not
// available right now" — never as licence to fall back to a normal category.
export async function getPremiumCategoryId(): Promise<string | null> {
  const [row] = await db
    .select({ id: gigCategories.id })
    .from(gigCategories)
    .where(eq(gigCategories.slug, PREMIUM_CATEGORY_SLUG));
  return row?.id ?? null;
}

// The browse page: gig cards with just enough worker context to render.
// The viewer decides whether premium gigs exist at all for this request —
// the `premium` filter is ignored unless they can see them.
export async function getGigCards(
  filters: BrowseFilters,
  viewer: PremiumViewer
): Promise<GigCard[]> {
  const conditions: SQL[] = [
    ...publicGigConditions(viewer),
    ...publicWorkerConditions(),
  ];

  if (viewer.canSeePremium && filters.premium) {
    conditions.push(eq(gigs.premium, true));
  }
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
    conditions.push(sql`${workers.avgRating} >= ${filters.minRatingX100}`);
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
      idVerified: sql<boolean>`(${users.idVerifiedAt} IS NOT NULL)`,
    })
    .from(gigs)
    .innerJoin(workers, eq(gigs.workerId, workers.id))
    .innerJoin(users, publicWorkerUserJoin)
    .innerJoin(gigCategories, eq(gigs.categoryId, gigCategories.id))
    .where(and(...conditions))
    .orderBy(desc(workers.avgRating), asc(gigs.title))
    .limit(60);

  // Language filter is an array column — filter in JS to keep the query simple.
  const filtered = filters.language
    ? rows.filter((r) => r.languages.some((l) => l === filters.language))
    : rows;

  const photos = await gigPhotoMap(
    filtered.map((r) => ({ gigId: r.id, workerId: r.workerId })),
    viewer
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
    premium: r.premium,
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
      idVerified: r.idVerified,
    },
  }));
}

// Cover photo per gig: the gig's own first tagged photo, else the worker's
// first untagged photo (untagged media shows everywhere by design).
// Media tagged to a gig this viewer may not see is skipped entirely, so a
// premium cover can never leak onto a standard card.
async function gigPhotoMap(
  pairs: { gigId: string; workerId: string }[],
  viewer: PremiumViewer
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
    .leftJoin(gigs, eq(workerMedia.gigId, gigs.id))
    .where(
      and(
        inArray(workerMedia.workerId, workerIds),
        eq(workerMedia.type, "photo"),
        // Untagged media (gigId null) is always visible; tagged media
        // inherits its gig's visibility.
        ...(viewer.canSeePremium
          ? []
          : [or(isNull(workerMedia.gigId), eq(gigs.premium, false))])
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

// A worker's live gigs for their public profile (with add-ons), narrowed to
// what this viewer may see.
export async function getPublicWorkerGigs(
  workerId: string,
  viewer: PremiumViewer
): Promise<PublicGigWithAddons[]> {
  const rows = await db
    .select(publicGigColumns)
    .from(gigs)
    .innerJoin(gigCategories, eq(gigs.categoryId, gigCategories.id))
    .where(and(eq(gigs.workerId, workerId), ...publicGigConditions(viewer)))
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
// Media tagged to a gig the viewer cannot see is hidden with the gig;
// untagged media is always visible.
export async function getGigMedia(
  workerId: string,
  gigId: string,
  viewer: PremiumViewer
) {
  const rows = await db
    .select({
      id: workerMedia.id,
      type: workerMedia.type,
      url: workerMedia.url,
      gigId: workerMedia.gigId,
      premium: gigs.premium,
    })
    .from(workerMedia)
    .leftJoin(gigs, eq(workerMedia.gigId, gigs.id))
    .where(
      and(
        eq(workerMedia.workerId, workerId),
        or(eq(workerMedia.gigId, gigId), isNull(workerMedia.gigId))
      )
    )
    .orderBy(asc(workerMedia.sortOrder));
  const visible = viewer.canSeePremium
    ? rows
    : rows.filter((r) => r.gigId === null || r.premium === false);
  return visible.map((r) => ({
    id: r.id,
    type: r.type,
    url: r.url,
    gigId: r.gigId,
  }));
}

// Keeps workers.baseRateCents (the browse "from" price) honest: the cheapest
// live fixed-price gig, else the cheapest live gig of any kind, else 0.
// Called by the gig actions after every change.
//
// PREMIUM gigs are excluded from the pool on purpose: the public "Starting
// at" figure must never leak a premium price. A worker with only premium
// gigs gets baseRate 0 and is hidden from the public worker lists entirely
// (see getPublicWorkers).
export async function syncWorkerBaseRate(workerId: string): Promise<void> {
  const rows = await db
    .select({ priceCents: gigs.priceCents, pricingMode: gigs.pricingMode })
    .from(gigs)
    .where(
      and(
        eq(gigs.workerId, workerId),
        ...publicGigConditions(PUBLIC_VIEWER)
      )
    );
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
