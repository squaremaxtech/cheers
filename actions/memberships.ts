"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { chargeMembership } from "@/lib/billing";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { getCardRow } from "@/lib/payments/cards";
import { paymentsConfigured, startCardSetup } from "@/lib/payments/powertranz";
import { cardSetupSchema } from "@/schemas/payment";
import type { ActionResult, MembershipCheckout } from "@/types";

// The monthly CheersJA Membership — the platform's own revenue, charged to a
// card the member stores with the gateway.
//
// There is no gateway-side subscription: PowerTranz is a card gateway, not a
// billing engine, so renewal is OUR clock (lib/billing.ts runBilling) charging
// the stored card once a month. Joining and renewing run the same
// chargeMembership() code path, so they can never drift apart.
//
// With no gateway configured this refuses politely, and the launch
// FREE_ACCESS_UNTIL flag keeps messaging and booking open for everyone in the
// meantime — nobody hits a wall they cannot pay through.

export async function startMembership(
  input: unknown
): Promise<ActionResult<MembershipCheckout>> {
  try {
    const user = await requireUser();
    const parsed = cardSetupSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    if (!paymentsConfigured()) {
      return err("Online payments are not live yet — membership is free for now.");
    }

    // No card yet: send them to the gateway to store one. The callback saves
    // it and brings them back here to press the button again — deliberately
    // two steps, so nobody is charged by a redirect they did not expect.
    const card = await getCardRow(user.id);
    if (!card) {
      const started = await startCardSetup({
        userId: user.id,
        returnPath: parsed.data.returnTo,
      });
      if (!started.ok) return err(started.message);
      return ok({ status: "card_required", url: started.url });
    }

    const charged = await chargeMembership(user.id);
    if (!charged.ok) return err(charged.message);

    revalidatePath("/membership");
    revalidatePath("/dashboard");
    return ok({
      status: "active",
      periodEnd: charged.periodEnd.toISOString(),
    });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Stop the renewals. The member keeps what they have already paid for — the
// period they are inside runs out on its own — so this only stops the next
// charge. Nothing is refunded because nothing is owed back.
export async function cancelMembership(): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));
    if (!membership || membership.status === "canceled") {
      return err("You don't have a membership to cancel.");
    }

    await db
      .update(memberships)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(memberships.userId, user.id));
    await notify({
      userId: user.id,
      type: "membership_canceled",
      title: "Your CheersJA Membership won't renew",
      body: membership.currentPeriodEnd
        ? `You keep access until ${membership.currentPeriodEnd.toDateString()}, and nothing further will be charged. Rejoin any time.`
        : "Nothing further will be charged. Rejoin any time.",
      email: false,
    });

    revalidatePath("/membership");
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
