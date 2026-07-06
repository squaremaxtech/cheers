"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  createMembershipCheckout,
  openBillingPortal,
} from "@/actions/memberships";

export default function MembershipActions({
  hasBilling,
  active,
}: {
  hasBilling: boolean;
  active: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<{ ok: true; data: { url: string } } | { ok: false; error: string }>) {
    setBusy(true);
    const res = await fn();
    if (res.ok) {
      window.location.href = res.data.url;
    } else {
      setBusy(false);
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {!active && (
        <button
          type="button"
          className="btn-gold"
          disabled={busy}
          onClick={() => go(createMembershipCheckout)}
        >
          {busy ? "Redirecting…" : "Join monthly membership"}
        </button>
      )}
      {hasBilling && (
        <button
          type="button"
          className="btn-outline"
          disabled={busy}
          onClick={() => go(openBillingPortal)}
        >
          Manage billing
        </button>
      )}
    </div>
  );
}
