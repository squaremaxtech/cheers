"use server";

import { err, ok } from "@/lib/action-result";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import { createMembershipCheckoutSession, stripeConfigured } from "@/lib/stripe";
import type { ActionResult } from "@/types";

// Start the monthly Cheers Membership subscription through Stripe Checkout.
// Status and renewal are webhook-driven from then on (/api/stripe/webhook).
//
// Cash-first: while Stripe is not configured this refuses — and the launch
// FREE_ACCESS_UNTIL flag keeps chat open for everyone in the meantime, so
// nobody hits a wall they cannot pay through.
export async function createMembershipCheckout(
  returnTo?: "membership" | "welcome"
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    if (!stripeConfigured()) {
      return err(
        "Online payments are not live yet — membership is free for now."
      );
    }

    const url = await createMembershipCheckoutSession({
      userId: user.id,
      customerEmail: user.email,
      returnPath: returnTo === "welcome" ? "/welcome" : "/membership",
    });
    if (!url) return err("Could not start checkout. Please try again.");
    return ok({ url });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
