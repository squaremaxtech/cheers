import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { rideEvents, rides } from "@/db/schema";
import { ConflictError } from "@/lib/bookings";
import {
  JAMAICA_UTC_OFFSET,
  RIDE_BASE_FARE_CENTS,
  RIDE_PER_KM_CENTS,
} from "@/lib/constants";
import { publishRide, rideEventNow } from "@/lib/realtime";
import type { RideRow, RideStatus } from "@/types";

// Human-readable ride reference, e.g. RD-4F7K2A
export function generateRideCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `RD-${out}`;
}

// "YYYY-MM-DDTHH:MM" from a datetime-local input as Jamaica wall-clock.
export function parseRideTime(local: string): Date {
  return new Date(`${local}:00${JAMAICA_UTC_OFFSET}`);
}

// The platform's fare guidance for a route. Per-driver guidance (their own
// per-km rate and minimum) is layered on top in the UI; the rider's offer is
// always free-form.
export function suggestedFareCents(distanceM: number): number {
  const km = distanceM / 1000;
  return Math.max(
    RIDE_BASE_FARE_CENTS,
    Math.round(RIDE_BASE_FARE_CENTS + km * RIDE_PER_KM_CENTS)
  );
}

// An open request past its expiry is dead even before any row update — reads
// must treat it so (the board query filters on this; pages derive it).
export function rideExpired(ride: RideRow): boolean {
  return ride.status === "requested" && ride.expiresAt.getTime() < Date.now();
}

// Allowed lifecycle transitions. Cancelled is terminal in every direction —
// a driver who bails releases the rider to post a fresh request rather than
// resurrecting a stale one under drivers who already moved on.
const transitions: Record<RideStatus, RideStatus[]> = {
  requested: ["accepted", "cancelled", "expired"],
  accepted: ["arriving", "picked_up", "cancelled"],
  arriving: ["picked_up", "cancelled"],
  picked_up: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  expired: [],
};

const TERMINAL_STATUSES: RideStatus[] = ["completed", "cancelled", "expired"];

export function canTransitionRide(
  from: RideStatus,
  to: RideStatus,
  isAdmin: boolean
): boolean {
  if (transitions[from].includes(to)) return true;
  // Admin override between live states only — finished rides stay finished
  // (same rule that fixed the reopened-booking incident).
  return isAdmin && !TERMINAL_STATUSES.includes(from);
}

// Move a ride to a new status and record the event. Compare-and-swap on the
// status the caller read; a concurrent transition loses and throws.
export async function transitionRide(opts: {
  ride: RideRow;
  to: RideStatus;
  actorUserId: string | null;
  note?: string;
  set?: Partial<typeof rides.$inferInsert>;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(rides)
      .set({ ...opts.set, status: opts.to, updatedAt: new Date() })
      .where(and(eq(rides.id, opts.ride.id), eq(rides.status, opts.ride.status)))
      .returning({ id: rides.id });
    if (updated.length === 0) throw new ConflictError();
    await tx.insert(rideEvents).values({
      rideId: opts.ride.id,
      fromStatus: opts.ride.status,
      toStatus: opts.to,
      actorUserId: opts.actorUserId,
      note: opts.note,
    });
  });
  // Every status change reaches the live ride room instantly.
  publishRide(opts.ride.id, rideEventNow("status"));
}
