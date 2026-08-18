import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import type { MembershipRow } from "@/types";

// Launch flag: Chat Pass free for everyone until this date (empty = off).
// This is what keeps chat open while Stripe is not yet live — cash-first.
export function freeAccessActive(): boolean {
  const until = process.env.FREE_ACCESS_UNTIL;
  if (!until) return false;
  const date = new Date(until);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

export async function getMembership(
  userId: string
): Promise<MembershipRow | null> {
  const [row] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId));
  return row ?? null;
}

// Chat Pass access — the $5/month subscription that unlocks messaging any
// worker. True when the launch free-access flag is live OR the user holds a
// paid pass whose period hasn't lapsed. Booking does NOT require this (see
// bookingRequiresChatPass in lib/constants.ts for the owner's later lever),
// and a booked customer/worker pair can always chat regardless
// (lib/chat-access.ts).
export async function hasChatAccess(userId: string): Promise<boolean> {
  if (freeAccessActive()) return true;
  const membership = await getMembership(userId);
  if (!membership) return false;
  return (
    membership.status === "active" &&
    membership.currentPeriodEnd !== null &&
    membership.currentPeriodEnd.getTime() > Date.now()
  );
}
