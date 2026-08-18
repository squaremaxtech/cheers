"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createChatPassCheckout } from "@/actions/memberships";
import { formatCents } from "@/lib/constants";

// Join / renew the $5/month Chat Pass through Stripe Checkout. Status and
// renewal are webhook-driven after the redirect.
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
    const res = await createChatPassCheckout("membership");
    if (res.ok) {
      window.location.href = res.data.url;
    } else {
      setBusy(false);
      toast.error(res.error);
    }
  }

  return (
    <button type="button" className="btn-gold" disabled={busy} onClick={pay}>
      {busy
        ? "Redirecting…"
        : active
          ? `Renew Chat Pass — ${formatCents(priceCents)}/month`
          : `Get the Chat Pass — ${formatCents(priceCents)}/month`}
    </button>
  );
}
