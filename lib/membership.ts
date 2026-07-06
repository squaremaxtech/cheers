import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import type { MembershipRow } from "@/types";

// Feature flag: platform-wide free access until this date (empty = disabled).
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

// Full platform access = free-access flag active OR an active subscription.
export async function hasMembershipAccess(userId: string): Promise<boolean> {
  if (freeAccessActive()) return true;
  const membership = await getMembership(userId);
  if (!membership) return false;
  return (
    membership.status === "active" &&
    (membership.currentPeriodEnd === null ||
      membership.currentPeriodEnd.getTime() > Date.now())
  );
}
