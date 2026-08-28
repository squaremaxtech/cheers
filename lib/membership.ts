import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import type { MembershipRow } from "@/types";

// Launch flag: the membership is free for everyone until this date (empty =
// off). This is what keeps messaging and booking open while Stripe is not yet
// live — cash-first. It is the ONLY switch on the membership gate.
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

// Cheers Membership — the monthly subscription that unlocks messaging AND
// booking for customers. True when the launch free-access window is open OR
// the user holds a paid membership whose period hasn't lapsed.
//
// Workers never need one. A booked customer/worker pair can always chat
// regardless (lib/chat-access.ts) — coordination is never paywalled.
export async function hasMemberAccess(userId: string): Promise<boolean> {
  if (freeAccessActive()) return true;
  const membership = await getMembership(userId);
  if (!membership) return false;
  return (
    membership.status === "active" &&
    membership.currentPeriodEnd !== null &&
    membership.currentPeriodEnd.getTime() > Date.now()
  );
}
