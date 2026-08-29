import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { paymentsConfigured } from "@/lib/payments/powertranz";
import type { MembershipRow } from "@/types";

// The one message every membership gate returns (booking, quotes, job
// requests) so the paywall reads the same everywhere.
export const MEMBERSHIP_REQUIRED =
  "A CheersJA Membership is required for this — join from the Membership page.";

// Launch flag: the membership is free for everyone until this date (empty =
// off). This is what keeps messaging and booking open while no card gateway is
// live. It is the ONLY switch on the membership gate.
export function freeAccessActive(): boolean {
  const until = process.env.FREE_ACCESS_UNTIL;
  if (!until) return false;
  const date = new Date(until);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

// How much runway the launch window has left. The membership gate is the ONLY
// thing standing between a customer and a booking, so when this lapses while
// no gateway is configured the whole funnel closes with no way to pay through
// it — the admin surfaces warn ahead of time on this.
export type FreeAccessStatus = {
  active: boolean;
  // Parsed FREE_ACCESS_UNTIL, or null when unset/unparseable.
  until: Date | null;
  // Whole days remaining (negative once lapsed, null when unset).
  daysLeft: number | null;
  // Set while the window is the only access path — i.e. no card gateway can
  // sell a membership — and it is lapsed or lapsing within 30 days.
  needsAttention: boolean;
};

// `paymentsLive` defaults to whether the card gateway is configured; callers
// may pass their own reading of it.
export function freeAccessStatus(
  paymentsLive: boolean = paymentsConfigured()
): FreeAccessStatus {
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
    needsAttention: !paymentsLive && (daysLeft === null || daysLeft <= 30),
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

// A membership that has actually been paid for and has not lapsed. Separate
// from hasMemberAccess because the launch window makes access true for
// everyone — this is the one that says "this person is a paying member".
export function membershipPaidActive(
  membership: MembershipRow | null,
  now = new Date()
): boolean {
  return Boolean(
    membership &&
      membership.status === "active" &&
      membership.currentPeriodEnd !== null &&
      membership.currentPeriodEnd.getTime() > now.getTime()
  );
}

// CheersJA Membership — the monthly subscription that unlocks messaging AND
// booking for customers. True when the launch free-access window is open OR
// the user holds a paid membership whose period hasn't lapsed.
//
// Renewal is driven by our own clock (lib/billing.ts runBilling) against the
// card in payment_cards, because PowerTranz is a card gateway, not a billing
// engine — there is no gateway-side subscription to read a status from.
//
// Workers never need one. A booked customer/worker pair can always chat
// regardless (lib/chat-access.ts) — coordination is never paywalled.
export async function hasMemberAccess(userId: string): Promise<boolean> {
  if (freeAccessActive()) return true;
  return membershipPaidActive(await getMembership(userId));
}
