"use server";

import { db } from "@/db";
import { membershipPayments } from "@/db/schema";
import { err, ok } from "@/lib/action-result";
import { membershipPriceCents } from "@/lib/constants";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import {
  appUrl,
  gatewayConfigured,
  initiateHostedPayment,
  storeRedirectPage,
} from "@/lib/powertranz";
import type { ActionResult } from "@/types";

// Start a membership payment (join or renew) through the PowerTranz hosted
// page. Memberships are prepaid fixed-term passes tracked locally: each
// successful payment extends currentPeriodEnd by MEMBERSHIP_PERIOD_DAYS on
// top of whatever time is left (see /api/pay/callback), so paying early
// never loses days. returnTo picks where the gateway sends the customer
// back — the membership page (default) or the first-login /welcome wizard.
export async function createMembershipCheckout(
  returnTo?: "membership" | "welcome"
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    if (!gatewayConfigured()) {
      return err("Memberships are not configured yet.");
    }

    const amountCents = membershipPriceCents();
    const [row] = await db
      .insert(membershipPayments)
      .values({ userId: user.id, amountCents })
      .returning({ id: membershipPayments.id });

    const returnPath = returnTo === "welcome" ? "welcome" : "membership";
    const init = await initiateHostedPayment({
      amountCents,
      orderId: `MEM-${row.id.slice(0, 8).toUpperCase()}`,
      responseUrl: appUrl(
        `/api/pay/callback?kind=membership&mp=${row.id}&return=${returnPath}`
      ),
    });
    const token = storeRedirectPage(init.redirectData);
    return ok({ url: appUrl(`/api/pay/session/${token}`) });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
