"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createMembershipCheckout } from "@/actions/memberships";
import { formatCents } from "@/lib/constants";

// Join / renew the prepaid membership through the hosted card page. Each
// payment adds a period on top of whatever time is left.
export default function MembershipActions({
  active,
  priceCents,
  periodDays,
}: {
  active: boolean;
  priceCents: number;
  periodDays: number;
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
    <button type="button" className="btn-gold" disabled={busy} onClick={pay}>
      {busy
        ? "Redirecting…"
        : active
          ? `Renew — add ${periodDays} days (${formatCents(priceCents)})`
          : `Join — ${formatCents(priceCents)} for ${periodDays} days`}
    </button>
  );
}
