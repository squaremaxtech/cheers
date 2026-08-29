"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cancelMembership, startMembership } from "@/actions/memberships";
import { formatCents } from "@/lib/constants";

// Join, renew or stop the monthly CheersJA Membership.
//
// Two deliberate steps when there is no card yet: the first press sends the
// browser to the gateway to store a card, and the charge only happens when
// they come back and press again. Nobody is charged by a redirect they were
// not expecting.
export default function MembershipActions({
  active,
  priceCents,
  hasCard,
}: {
  active: boolean;
  priceCents: number;
  hasCard: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    const res = await startMembership({ returnTo: "membership" });
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    if (res.data.status === "card_required") {
      window.location.href = res.data.url;
      return;
    }
    setBusy(false);
    toast.success(
      `Membership active until ${new Date(res.data.periodEnd).toDateString()}`
    );
    router.refresh();
  }

  async function stop() {
    if (
      !window.confirm(
        "Stop your membership renewing? You keep access until the end of the period you've paid for."
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await cancelMembership();
    setBusy(false);
    if (res.ok) {
      toast.success("Your membership won't renew");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const payLabel = !hasCard
    ? `Add a card — ${formatCents(priceCents)}/month`
    : active
      ? `Renew now — ${formatCents(priceCents)}/month`
      : `Join CheersJA Membership — ${formatCents(priceCents)}/month`;

  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" className="btn-primary" disabled={busy} onClick={pay}>
        {busy ? "Working…" : payLabel}
      </button>
      {active && (
        <button type="button" className="btn-ghost" disabled={busy} onClick={stop}>
          Stop renewing
        </button>
      )}
    </div>
  );
}
