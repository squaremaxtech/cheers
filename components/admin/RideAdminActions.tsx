"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cancelRide } from "@/actions/rides";

// Force-cancel a live ride (admin override). Both sides are notified by the
// action; the reason lands in the ride's event trail.
export default function RideAdminActions({ rideId }: { rideId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function forceCancel() {
    const reason = window.prompt(
      "Cancel this ride? Reason (both sides may see it):"
    );
    if (reason === null) return;
    setBusy(true);
    const res = await cancelRide({
      rideId,
      reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Ride cancelled");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={forceCancel}
      className="btn border border-danger/40 px-2.5 py-1 text-xs text-danger"
    >
      Force cancel
    </button>
  );
}
