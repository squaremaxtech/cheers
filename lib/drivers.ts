import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { drivers } from "@/db/schema";
import type { DriverBrowseFilters, DriverRow, PublicDriver } from "@/types";

// The ONLY columns public queries may select — userId and stripeAccountId
// stay private (same discipline as publicWorkerColumns).
export const publicDriverColumns = {
  id: drivers.id,
  displayName: drivers.displayName,
  slug: drivers.slug,
  bio: drivers.bio,
  facePhotoUrl: drivers.facePhotoUrl,
  parish: drivers.parish,
  city: drivers.city,
  vehicleMake: drivers.vehicleMake,
  vehicleModel: drivers.vehicleModel,
  vehicleYear: drivers.vehicleYear,
  vehicleColor: drivers.vehicleColor,
  vehiclePhotoUrl: drivers.vehiclePhotoUrl,
  perKmRateCents: drivers.perKmRateCents,
  minFareCents: drivers.minFareCents,
  avgRating: drivers.avgRating,
  reviewCount: drivers.reviewCount,
};

// A driver the public may see and request: approved (verified), switched on
// (active), not suspended. Registration alone shows nothing — the face photo,
// vehicle and reviewed ID are what earn a public card.
export function publicDriverConditions(): SQL[] {
  return [
    eq(drivers.verified, true),
    eq(drivers.active, true),
    eq(drivers.suspended, false),
  ];
}

export async function getPublicDrivers(
  filters: DriverBrowseFilters
): Promise<PublicDriver[]> {
  const conditions: SQL[] = publicDriverConditions();
  if (filters.q) {
    const term = `%${filters.q}%`;
    const match = or(
      ilike(drivers.displayName, term),
      ilike(drivers.vehicleMake, term),
      ilike(drivers.vehicleModel, term)
    );
    if (match) conditions.push(match);
  }
  if (filters.parish) conditions.push(eq(drivers.parish, filters.parish));
  if (filters.minRatingX100) {
    conditions.push(sql`${drivers.avgRating} >= ${filters.minRatingX100}`);
  }

  return db
    .select(publicDriverColumns)
    .from(drivers)
    .where(and(...conditions))
    .orderBy(desc(drivers.avgRating), asc(drivers.displayName))
    .limit(60);
}

export async function driverForUser(userId: string): Promise<DriverRow | null> {
  const [row] = await db
    .select()
    .from(drivers)
    .where(eq(drivers.userId, userId));
  return row ?? null;
}

// The vehicle line riders see everywhere: "White Toyota Probox · 1234 GK".
// The plate is passed only for a matched ride (it is not in PublicDriver —
// riders get it once a driver is locked in, to check before boarding).
export function vehicleLabel(d: {
  vehicleColor: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehiclePlate?: string;
}): string {
  const year = d.vehicleYear ? ` ${d.vehicleYear}` : "";
  const plate = d.vehiclePlate ? ` · ${d.vehiclePlate}` : "";
  return `${d.vehicleColor} ${d.vehicleMake} ${d.vehicleModel}${year}${plate}`;
}
