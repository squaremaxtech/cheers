"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { completeRide, markPickedUp, startArriving } from "@/actions/rides";
import RideCancelButton from "@/components/rides/RideCancelButton";
import type { RideStatus } from "@/types";

// The matched driver's lifecycle buttons: accepted → arriving → picked_up →
// completed (accepted may jump straight to picked_up — a driver who was
// already outside). Cancel stays available on every live status.
export default function DriverRideControls({
  rideId,
  status,
}: {
  rideId: string;
  status: RideStatus;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function run(
    action: (input: unknown) => Promise<{ ok: true; data: undefined } | { ok: false; error: string }>,
    success: string
  ) {
    setWorking(true);
    const res = await action({ rideId });
    setWorking(false);
    if (res.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(res.error);
      router.refresh();
    }
  }

  const live =
    status === "accepted" || status === "arriving" || status === "picked_up";
  if (!live) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "accepted" && (
        <button
          type="button"
          className="btn-gold"
          disabled={working}
          onClick={() => run(startArriving, "Rider notified — you're on the way")}
        >
          I&apos;m on my way
        </button>
      )}
      {(status === "accepted" || status === "arriving") && (
        <button
          type="button"
          className={status === "arriving" ? "btn-gold" : "btn-outline"}
          disabled={working}
          onClick={() => run(markPickedUp, "Trip started")}
        >
          Rider on board
        </button>
      )}
      {status === "picked_up" && (
        <button
          type="button"
          className="btn-gold"
          disabled={working}
          onClick={() => run(completeRide, "Ride completed — collect the cash fare")}
        >
          Complete ride
        </button>
      )}
      <RideCancelButton rideId={rideId} />
    </div>
  );
}
