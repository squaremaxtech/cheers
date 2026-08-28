import { and, asc, desc, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { favorites, gigs, users, workerMedia, workers } from "@/db/schema";
import type {
  PremiumViewer,
  PublicWorker,
  PublicWorkerWithPhoto,
} from "@/types";

// The ONLY columns public queries may select. realName/userId stay private.
// idVerified is joined from users.id_verified_at — the badge, never the id.
export const publicWorkerColumns = {
  id: workers.id,
  stageName: workers.stageName,
  slug: workers.slug,
  bio: workers.bio,
  headline: workers.headline,
  skills: workers.skills,
  yearsExperience: workers.yearsExperience,
  languages: workers.languages,
  parish: workers.parish,
  city: workers.city,
  baseRateCents: workers.baseRateCents,
  avgRating: workers.avgRating,
  reviewCount: workers.reviewCount,
  idVerified: sql<boolean>`(${users.idVerifiedAt} IS NOT NULL)`,
};

// Every query using publicWorkerColumns must join users on workers.userId —
// idVerified reads users.id_verified_at.
export const publicWorkerUserJoin = eq(workers.userId, users.id);

// A worker the public may see, book or message: switched on by the worker
// (active) and not suspended by an admin. Professionals publish themselves —
// there is no approval queue and nothing waits on the business owner.
export function publicWorkerConditions(): SQL[] {
  return [eq(workers.active, true), eq(workers.suspended, false)];
}

// Worker cards for surfaces that list PEOPLE rather than gigs (home
// featured, favorites). Browse itself is gig-centric — see lib/gigs.ts.
//
// Only workers with at least one live NON-PREMIUM gig appear: a professional
// who offers premium services exclusively does not exist for the public.
export async function getPublicWorkers(opts?: {
  limit?: number;
}): Promise<PublicWorkerWithPhoto[]> {
  const rows = await db
    .select(publicWorkerColumns)
    .from(workers)
    .innerJoin(users, eq(workers.userId, users.id))
    .where(
      and(
        ...publicWorkerConditions(),
        exists(
          db
            .select({ one: sql`1` })
            .from(gigs)
            .where(
              and(
                eq(gigs.workerId, workers.id),
                eq(gigs.premium, false),
                // = publicGigConditions() from lib/gigs.ts, inlined to keep
                // this module free of a circular import.
                eq(gigs.active, true),
                eq(gigs.suspended, false)
              )
            )
        )
      )
    )
    .orderBy(desc(workers.avgRating), asc(workers.stageName))
    .limit(opts?.limit ?? 60);
  return attachPrimaryPhotos(rows);
}

// One customer's saved professionals (/favorites). Favourites are saved at
// WORKER level, so the premium rail is applied the same way the public
// profile applies it (plan §1.3): a professional whose live gigs are ALL
// premium does not exist for a viewer who cannot see premium and drops off
// the list; one with no live gigs at all still shows (they are setting up),
// exactly as their profile page still renders.
export async function getFavoriteWorkers(
  customerId: string,
  viewer: PremiumViewer
): Promise<PublicWorkerWithPhoto[]> {
  const rows = await db
    .select(publicWorkerColumns)
    .from(favorites)
    .innerJoin(workers, eq(favorites.workerId, workers.id))
    .innerJoin(users, publicWorkerUserJoin)
    .where(
      and(eq(favorites.customerId, customerId), ...publicWorkerConditions())
    )
    .orderBy(desc(favorites.createdAt));
  if (rows.length === 0 || viewer.canSeePremium) {
    return attachPrimaryPhotos(rows);
  }

  // Live vs viewer-visible gig counts per saved worker. The gig conditions
  // are inlined (= publicGigConditions() in lib/gigs.ts) to keep this
  // module free of a circular import.
  const counts = await db
    .select({
      workerId: gigs.workerId,
      live: sql<number>`count(*)::int`,
      visible: sql<number>`(count(*) FILTER (WHERE ${gigs.premium} = false))::int`,
    })
    .from(gigs)
    .where(
      and(
        inArray(
          gigs.workerId,
          rows.map((r) => r.id)
        ),
        eq(gigs.active, true),
        eq(gigs.suspended, false)
      )
    )
    .groupBy(gigs.workerId);
  const byWorker = new Map(counts.map((c) => [c.workerId, c]));

  const visible = rows.filter((r) => {
    const count = byWorker.get(r.id);
    if (!count || Number(count.live) === 0) return true; // still setting up
    return Number(count.visible) > 0;
  });
  return attachPrimaryPhotos(visible);
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
