import { eq } from "drizzle-orm";
import { db } from "@/db";
import { drivers, rides } from "@/db/schema";
import { isModeratingStaff } from "@/lib/guards";
import type { DriverRow, RideRow, UserRow } from "@/types";

// The viewer's relationship to a ride. Staff (admin/desk support) can read
// every ride room for dispute handling but take no lifecycle actions there.
export type RideViewerRole = "rider" | "driver" | "staff";

export type RideAccess = {
  ride: RideRow;
  viewerRole: RideViewerRole;
  // The MATCHED driver's row (null until a driver is locked in). This is the
  // only path that ever carries the plate to a rider — public queries use
  // publicDriverColumns, which excludes it.
  driver: DriverRow | null;
};

// Who may enter a ride room: the rider who posted it, the matched driver
// (drivers.userId), and moderating staff. Returns null for everyone else —
// callers 404 without leaking that the ride exists. Drivers with an open
// offer but no match deliberately get nothing: they see the request on the
// board, not the rider's room.
export async function loadRideAccess(
  user: UserRow,
  rideId: string
): Promise<RideAccess | null> {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId));
  if (!ride) return null;

  let driver: DriverRow | null = null;
  if (ride.driverId) {
    const [d] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, ride.driverId));
    driver = d ?? null;
  }

  if (ride.riderUserId === user.id) {
    return { ride, viewerRole: "rider", driver };
  }
  if (driver && driver.userId === user.id) {
    return { ride, viewerRole: "driver", driver };
  }
  if (isModeratingStaff(user)) {
    return { ride, viewerRole: "staff", driver };
  }
  return null;
}
