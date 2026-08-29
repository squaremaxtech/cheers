import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentCards, users } from "@/db/schema";
import type { CardOnFile, PaymentCardRow } from "@/types";
import type { StoredCard } from "@/lib/payments/powertranz";

// The card a user has stored with the gateway. One per user, and the row NEVER
// contains a PAN: `token` is the gateway's stored-credential handle and the
// brand/last4/expiry exist only so a person can recognise which card is about
// to be charged.
//
// It backs both money-in flows — a customer's membership and a professional's
// monthly commission — and nothing else. No card is ever charged for a job.

export async function getCardRow(
  userId: string
): Promise<PaymentCardRow | null> {
  const [row] = await db
    .select()
    .from(paymentCards)
    .where(eq(paymentCards.userId, userId));
  return row ?? null;
}

// Display-only projection. Use this for anything that reaches a page — it
// cannot leak the gateway token by accident.
export async function getCardOnFile(userId: string): Promise<CardOnFile | null> {
  const row = await getCardRow(userId);
  if (!row) return null;
  return {
    brand: row.brand,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    addedAt: row.createdAt.toISOString(),
  };
}

// Store (or replace) the user's card. Replacing is the same write: one row per
// user, so adding a new card retires the old one automatically.
export async function saveCardOnFile(opts: {
  userId: string;
  card: StoredCard;
  gatewayCustomerId?: string | null;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(paymentCards)
    .values({
      userId: opts.userId,
      token: opts.card.token,
      brand: opts.card.brand,
      last4: opts.card.last4,
      expMonth: opts.card.expMonth,
      expYear: opts.card.expYear,
    })
    .onConflictDoUpdate({
      target: paymentCards.userId,
      set: {
        token: opts.card.token,
        brand: opts.card.brand,
        last4: opts.card.last4,
        expMonth: opts.card.expMonth,
        expYear: opts.card.expYear,
        updatedAt: now,
      },
    });

  if (opts.gatewayCustomerId) {
    await db
      .update(users)
      .set({ gatewayCustomerId: opts.gatewayCustomerId, updatedAt: now })
      .where(eq(users.id, opts.userId));
  }
}

