"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cancelRide } from "@/actions/rides";

// Cancel a ride (rider or matched driver — the action checks). Confirmation
// guard because cancelling is terminal: the request cannot be reopened.
export default function RideCancelButton({
  rideId,
  label = "Cancel ride",
}: {
  rideId: string;
  label?: string;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function handleCancel() {
    if (
      !window.confirm(
        "Cancel this ride? This can't be undone — you'd need to post a new request."
      )
    ) {
      return;
    }
    setWorking(true);
    const res = await cancelRide({ rideId });
    setWorking(false);
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
      className="btn-danger"
      disabled={working}
      onClick={handleCancel}
    >
      {working ? "Cancelling…" : label}
    </button>
  );
}
