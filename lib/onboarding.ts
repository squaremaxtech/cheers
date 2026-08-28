import { TERMS_VERSION } from "@/lib/constants";
import type { UserRow } from "@/types";

// The one "is this account ready to transact" rule (plan §2.3 gate order).
// A customer must be reachable (name + phone) and must have accepted the
// legal terms — nothing else. Identity verification is an optional badge and
// gates nothing.
//
// Deliberately reads the columns rather than users.onboardedAt: an account
// created before the /welcome wizard existed passes as soon as it has a
// profile and has accepted the terms from the dashboard banner.
export function customerNeedsOnboarding(user: UserRow): boolean {
  if (user.role !== "customer") return false;
  return (
    (user.name ?? "").trim().length === 0 ||
    (user.phone ?? "").trim().length === 0 ||
    user.termsAcceptedAt === null
  );
}

export const ONBOARDING_REQUIRED =
  "Finish setting up your account first — add your name and phone number and accept the terms.";

// The dashboard banner rule (plan §2.4): never accepted, or accepted an older
// version of the documents. Only the first case blocks transacting (above);
// a version bump re-prompts everyone without locking anyone out.
export function needsTermsAcceptance(
  user: Pick<UserRow, "termsAcceptedAt" | "termsVersion">
): boolean {
  return user.termsAcceptedAt === null || user.termsVersion !== TERMS_VERSION;
}
