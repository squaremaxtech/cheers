import { eq } from "drizzle-orm";
import { db } from "@/db";
import { identityVerifications, users } from "@/db/schema";
import type { IdentityVerificationRow } from "@/types";

// One identity_verifications row per user. Customers AND workers may submit.
export async function getIdentityVerification(
  userId: string
): Promise<IdentityVerificationRow | null> {
  const [row] = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, userId));
  return row ?? null;
}

// The optional "Verified ID" badge. It gates NOTHING — booking, posting,
// quoting and messaging all work without it. Read from the denormalised
// users.id_verified_at so cards and risk summaries need no extra join.
export async function isIdVerified(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ idVerifiedAt: users.idVerifiedAt })
    .from(users)
    .where(eq(users.id, userId));
  return row?.idVerifiedAt !== null && row?.idVerifiedAt !== undefined;
}
