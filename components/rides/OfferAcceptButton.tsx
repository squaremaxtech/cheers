"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { riderAcceptOffer } from "@/actions/rides";

// Rider locks in one driver's offer. Accepting rejects every sibling offer
// server-side; the room re-renders as matched.
export default function OfferAcceptButton({
  rideId,
  offerId,
}: {
  rideId: string;
  offerId: string;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function handleAccept() {
    setWorking(true);
    const res = await riderAcceptOffer({ rideId, offerId });
    setWorking(false);
    if (res.ok) {
      toast.success("Driver confirmed — check the plate before you get in.");
      router.refresh();
    } else {
      toast.error(res.error);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className="btn-primary"
      disabled={working}
      onClick={handleAccept}
    >
      {working ? "Confirming…" : "Accept"}
    </button>
  );
}
