"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  setCustomerPremiumAccess,
  setWorkerPremiumProvider,
} from "@/actions/admin";

// The one button per row on /admin/promote. Two shapes, because the two
// grants are different things on different tables: a CUSTOMER holds premium
// access (they can see, search and book premium services), a PROFESSIONAL
// holds premium provider status (they may publish them).
//
// Both actions are admin-only and audited server-side — this component is a
// convenience, never the gate.
type PromoteActionsProps =
  | { kind: "customer"; userId: string; enabled: boolean }
  | { kind: "provider"; workerId: string; displayName: string; enabled: boolean };

export default function PromoteActions(props: PromoteActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    // Turning a provider off takes their premium listings down with it, and
    // that is not reversible by turning it back on — confirm before it runs.
    if (props.kind === "provider" && props.enabled) {
      const confirmed = window.confirm(
        `Disable premium services for ${props.displayName}? Every premium gig they have live is deactivated immediately, and re-enabling later does not restore them — they publish them again themselves.`
      );
      if (!confirmed) return;
    }

    setBusy(true);
    const res =
      props.kind === "customer"
        ? await setCustomerPremiumAccess({
            userId: props.userId,
            enabled: !props.enabled,
          })
        : await setWorkerPremiumProvider({
            workerId: props.workerId,
            enabled: !props.enabled,
          });
    setBusy(false);

    if (res.ok) {
      toast.success(props.enabled ? "Premium removed" : "Premium granted");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const label =
    props.kind === "customer"
      ? props.enabled
        ? "Revoke"
        : "Grant premium access"
      : props.enabled
        ? "Disable"
        : "Enable premium services";

  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className={`btn whitespace-nowrap border px-2.5 py-1 text-xs ${
        props.enabled
          ? "border-danger/40 text-danger"
          : "border-hairline text-muted hover:text-brand"
      }`}
    >
      {label}
    </button>
  );
}
