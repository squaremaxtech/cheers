"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  acceptBooking,
  cancelBooking,
  completeBooking,
  declineBooking,
  reassignBooking,
} from "@/actions/bookings";
import Select from "@/components/ui/Select";
import type { ActionResult, BookingStatus } from "@/types";

// Force-cancel is the desk remedy for a complaint and is available to desk
// support; deciding, completing and reassigning a booking on the parties'
// behalf stays with admins, so those controls are not rendered for support.
export default function AdminBookingActions({
  bookingId,
  status,
  workers,
  isAdmin,
}: {
  bookingId: string;
  status: BookingStatus;
  workers: { id: string; stageName: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reassignTo, setReassignTo] = useState("");

  const terminal =
    status === "completed" ||
    status === "declined" ||
    status === "cancelled" ||
    status === "refunded";

  async function run(fn: () => Promise<ActionResult<undefined>>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (terminal) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && status === "pending" && (
        <>
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => run(() => acceptBooking({ bookingId }), "Accepted")}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn-danger px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => run(() => declineBooking({ bookingId }), "Declined")}
          >
            Decline
          </button>
        </>
      )}
      {isAdmin &&
        (status === "accepted" ||
          status === "confirmed" ||
          status === "in_progress") && (
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => run(() => completeBooking({ bookingId }), "Completed")}
          >
            Mark completed
          </button>
        )}
      <button
        type="button"
        className="btn-danger px-3 py-1.5 text-xs"
        disabled={busy}
        onClick={() => {
          const reason = window.prompt("Cancellation reason (sent to both parties):");
          if (reason !== null) {
            run(
              () => cancelBooking({ bookingId, reason: reason || undefined }),
              "Force-cancelled"
            );
          }
        }}
      >
        Force cancel
      </button>

      {isAdmin && (
        <span className="ml-2 flex items-center gap-1">
          <Select
            size="sm"
            className="w-44"
            ariaLabel="Reassign to"
            placeholder="Reassign to…"
            value={reassignTo}
            onChange={(v) => setReassignTo(v)}
            options={workers.map((w) => ({
              value: w.id,
              label: w.stageName,
            }))}
          />
          <button
            type="button"
            className="btn-outline px-3 py-1.5 text-xs"
            disabled={busy || !reassignTo}
            onClick={() =>
              run(
                () => reassignBooking({ bookingId, newWorkerId: reassignTo }),
                "Reassigned"
              )
            }
          >
            Go
          </button>
        </span>
      )}
    </div>
  );
}
