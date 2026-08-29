import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  favorites,
  feeInvoices,
  gigs,
  users,
  workerMedia,
  workers,
} from "@/db/schema";
import {
  FEE_BLOCK_MIN_ATTEMPTS,
  FEE_GRACE_DAYS,
} from "@/lib/payments/config";
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

// Unpaid commission pauses a professional's listings — the SQL twin of
// lib/billing.ts workerBillingBlocked(), which is the authority on the rule
// but is async and per-worker, so it cannot run inside a query builder. Keep
// the two in step: a FAILED statement, at least FEE_BLOCK_MIN_ATTEMPTS
// declines, unpaid for longer than the grace period. Never a single decline,
// and never a statement we have not tried to charge.
//
// This is the platform's only lever for a fee it does not hold: the customer
// pays the professional directly, so the commission is a debt, and the
// listings are the collateral.
function commissionCurrent(): SQL {
  // The cutoff is computed here rather than in SQL so the grace period travels
  // as a timestamp parameter: "$n * interval" leaves Postgres guessing at the
  // parameter type, and the async twin in lib/billing.ts already works this way.
  const cutoff = new Date(Date.now() - FEE_GRACE_DAYS * 86_400_000);
  return sql`NOT EXISTS (
    SELECT 1 FROM ${feeInvoices}
    WHERE ${feeInvoices.workerId} = ${workers.id}
      AND ${feeInvoices.status} = 'failed'
      AND ${feeInvoices.attempts} >= ${FEE_BLOCK_MIN_ATTEMPTS}
      AND ${feeInvoices.dueAt} <= ${cutoff}
  )`;
}

// A worker the public may see, book or message: switched on by the worker
// (active), not suspended by an admin, and not paused for unpaid commission.
// Professionals publish themselves — there is no approval queue and nothing
// waits on the business owner.
export function publicWorkerConditions(): SQL[] {
  return [
    eq(workers.active, true),
    eq(workers.suspended, false),
    commissionCurrent(),
  ];
}

// Worker cards for surfaces that list PEOPLE rather than gigs (home
// featured, favorites). Browse itself is gig-centric — see lib/gigs.ts.
//
// Only workers with at least one live gig THIS VIEWER may see appear: a
// professional who offers premium services exclusively does not exist for the
// public, and does appear for a premium member — the same rail the gig
// queries and the public profile use (plan §1.3). The viewer is required so
// no caller can fall into a permissive default by accident.
export async function getPublicWorkers(
  viewer: PremiumViewer,
  opts?: {
    limit?: number;
  }
): Promise<PublicWorkerWithPhoto[]> {
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
                ...(viewer.canSeePremium ? [] : [eq(gigs.premium, false)]),
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
  return attachPrimaryPhotos(rows, viewer);
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
    return attachPrimaryPhotos(rows, viewer);
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
  return attachPrimaryPhotos(visible, viewer);
}

// The card image for a list of professionals. Media tagged to a gig inherits
// that gig's visibility, so a photo attached to a PREMIUM service is hidden
// from a viewer who may not see the service; untagged portfolio media is
// always visible. Same predicate as lib/gigs.ts gigPhotoMap — without it a
// premium listing leaks as a picture on an otherwise standard card.
export async function attachPrimaryPhotos(
  rows: PublicWorker[],
  viewer: PremiumViewer
): Promise<PublicWorkerWithPhoto[]> {
  if (rows.length === 0) return [];
  const media = await db
    .select({
      workerId: workerMedia.workerId,
      url: workerMedia.url,
      sortOrder: workerMedia.sortOrder,
    })
    .from(workerMedia)
    .leftJoin(gigs, eq(workerMedia.gigId, gigs.id))
    .where(
      and(
        inArray(workerMedia.workerId, rows.map((r) => r.id)),
        eq(workerMedia.type, "photo"),
        ...(viewer.canSeePremium
          ? []
          : [or(isNull(workerMedia.gigId), eq(gigs.premium, false))])
      )
    )
    .orderBy(asc(workerMedia.sortOrder));

  const firstPhoto = new Map<string, string>();
  for (const m of media) {
    if (!firstPhoto.has(m.workerId)) firstPhoto.set(m.workerId, m.url);
  }
  return rows.map((w) => ({ ...w, photoUrl: firstPhoto.get(w.id) ?? null }));
}
