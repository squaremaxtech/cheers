import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customerVerifications } from "@/db/schema";
import type { CustomerVerificationRow } from "@/types";

export async function getCustomerVerification(
  userId: string
): Promise<CustomerVerificationRow | null> {
  const [row] = await db
    .select()
    .from(customerVerifications)
    .where(eq(customerVerifications.userId, userId));
  return row ?? null;
}

// Booking gate: customers may only book once staff has approved their ID.
export async function isCustomerVerified(userId: string): Promise<boolean> {
  const verification = await getCustomerVerification(userId);
  return verification?.status === "approved";
}
