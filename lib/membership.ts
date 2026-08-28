import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import type { MembershipRow } from "@/types";

// The one message every membership gate returns (booking, quotes, job
// requests) so the paywall reads the same everywhere.
export const MEMBERSHIP_REQUIRED =
  "A Cheers Membership is required for this — join from the Membership page.";

// Launch flag: the membership is free for everyone until this date (empty =
// off). This is what keeps messaging and booking open while Stripe is not yet
// live — cash-first. It is the ONLY switch on the membership gate.
export function freeAccessActive(): boolean {
  const until = process.env.FREE_ACCESS_UNTIL;
  if (!until) return false;
  const date = new Date(until);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

// How much runway the launch window has left. The membership gate is the ONLY
// thing standing between a customer and a booking, so when this lapses while
// Stripe is dormant the whole funnel closes with no way to pay through it —
// the admin surfaces warn ahead of time on this.
export type FreeAccessStatus = {
  active: boolean;
  // Parsed FREE_ACCESS_UNTIL, or null when unset/unparseable.
  until: Date | null;
  // Whole days remaining (negative once lapsed, null when unset).
  daysLeft: number | null;
  // Set while the window is the only access path — i.e. Stripe cannot sell a
  // membership — and it is lapsed or lapsing within 30 days.
  needsAttention: boolean;
};

export function freeAccessStatus(stripeLive: boolean): FreeAccessStatus {
  const raw = process.env.FREE_ACCESS_UNTIL;
  const parsed = raw ? new Date(raw) : null;
  const until =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const daysLeft =
    until === null
      ? null
      : Math.floor((until.getTime() - Date.now()) / 86_400_000);
  const active = until !== null && until.getTime() > Date.now();
  return {
    active,
    until,
    daysLeft,
    needsAttention: !stripeLive && (daysLeft === null || daysLeft <= 30),
  };
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
