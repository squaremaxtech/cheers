"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import { getMembership } from "@/lib/membership";
import { appUrl, stripe } from "@/lib/stripe";
import type { ActionResult } from "@/types";

// Start (or restart) the monthly membership subscription via Stripe Checkout.
export async function createMembershipCheckout(): Promise<
  ActionResult<{ url: string }>
> {
  try {
    const user = await requireUser();
    const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID;
    if (!priceId) return err("Memberships are not configured yet.");

    const existing = await getMembership(user.id);
    if (existing?.status === "active") {
      return err("You already have an active membership.");
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: existing?.stripeCustomerId ? undefined : user.email,
      customer: existing?.stripeCustomerId ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { kind: "membership", userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      success_url: appUrl("/membership?success=1"),
      cancel_url: appUrl("/membership?cancelled=1"),
    });

    if (!session.url) return err(ERR.server);
    return ok({ url: session.url });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Stripe Billing Portal for cancel / update card.
export async function openBillingPortal(): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));
    if (!membership?.stripeCustomerId) {
      return err("No billing profile found. Join first.");
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: membership.stripeCustomerId,
      return_url: appUrl("/membership"),
    });
    return ok({ url: session.url });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
