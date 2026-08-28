import { isDeskSupport } from "@/lib/guards";
import type { PremiumViewer, UserRow, WorkerRow } from "@/types";

// The premium tier is admin-curated: an admin grants a customer premium
// ACCESS (users.premiumAccessAt) and a worker premium PROVIDER status
// (workers.premiumProviderAt). Premium gigs, their media and their prices are
// invisible to everyone else — no badge, no placeholder, no trace.
//
// This module is the single source of that truth. Every public gig query
// takes the PremiumViewer it produces and, when canSeePremium is false,
// appends gigs.premium = false.

// True iff the user may see premium listings. Signed-out visitors never can.
// Staff (admin + desk support) always can — they moderate premium content.
export function canSeePremium(user: UserRow | null): boolean {
  if (!user) return false;
  return (
    user.premiumAccessAt !== null ||
    user.role === "admin" ||
    isDeskSupport(user)
  );
}

// Wraps the predicate for the query layer. Pass this, not a raw boolean, so a
// missing viewer is a type error rather than a silent leak.
export function viewerPremium(user: UserRow | null): PremiumViewer {
  return { canSeePremium: canSeePremium(user) };
}

// A viewer that can never see premium — for signed-out/public rendering paths
// where there is nobody to check.
export const PUBLIC_VIEWER: PremiumViewer = { canSeePremium: false };

// A viewer that sees everything — for the worker's own dashboard and admin
// tooling, where the listings belong to (or are moderated by) the viewer.
export const STAFF_VIEWER: PremiumViewer = { canSeePremium: true };

// May this worker publish premium gigs?
export function isPremiumProvider(
  worker: Pick<WorkerRow, "premiumProviderAt">
): boolean {
  return worker.premiumProviderAt !== null;
}

// Does this customer hold premium access?
export function hasPremiumAccess(
  user: Pick<UserRow, "premiumAccessAt">
): boolean {
  return user.premiumAccessAt !== null;
}
