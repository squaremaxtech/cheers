"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createMembershipCheckout } from "@/actions/memberships";
import { formatCents } from "@/lib/constants";

// Join / renew the monthly Cheers Membership through Stripe Checkout. Status
// and renewal are webhook-driven after the redirect.
export default function MembershipActions({
  active,
  priceCents,
}: {
  active: boolean;
  priceCents: number;
}) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    const res = await createMembershipCheckout("membership");
    if (res.ok) {
      window.location.href = res.data.url;
    } else {
      setBusy(false);
      toast.error(res.error);
    }
  }

  return (
    <button type="button" className="btn-primary" disabled={busy} onClick={pay}>
      {busy
        ? "Redirecting…"
        : active
          ? `Renew membership — ${formatCents(priceCents)}/month`
          : `Join Cheers Membership — ${formatCents(priceCents)}/month`}
    </button>
  );
}
