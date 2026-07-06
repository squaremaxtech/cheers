"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  acceptBooking,
  cancelBooking,
  completeBooking,
  declineBooking,
} from "@/actions/bookings";
import { recordCashPayment } from "@/actions/payments";
import type { ActionResult, BookingStatus } from "@/types";

export default function WorkerBookingActions({
  bookingId,
  status,
  serviceTotalCents,
}: {
  bookingId: string;
  status: BookingStatus;
  serviceTotalCents: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showCash, setShowCash] = useState(false);

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

  async function handleCash(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await recordCashPayment({
      bookingId,
      amountCents: Math.round(Number(form.get("amount") ?? 0) * 100),
      tipCents: Math.round(Number(form.get("tip") ?? 0) * 100),
      proofUrl: form.get("proofUrl"),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Cash payment recorded");
      setShowCash(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <>
            <button
              type="button"
              className="btn-gold"
              disabled={busy}
              onClick={() => run(() => acceptBooking({ bookingId }), "Booking accepted")}
            >
              Accept
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => run(() => declineBooking({ bookingId }), "Booking declined")}
            >
              Decline
            </button>
          </>
        )}

        {(status === "accepted" || status === "confirmed") && (
          <button
            type="button"
            className="btn-outline"
            disabled={busy}
            onClick={() => setShowCash((v) => !v)}
          >
            Record cash payment
          </button>
        )}

        {(status === "confirmed" || status === "in_progress") && (
          <button
            type="button"
            className="btn-gold"
            disabled={busy}
            onClick={() =>
              run(() => completeBooking({ bookingId }), "Marked completed — review requested")
            }
          >
            Mark completed
          </button>
        )}

        {(status === "accepted" || status === "confirmed") && (
          <button
            type="button"
            className="btn-ghost text-danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Cancel this booking?")) {
                run(() => cancelBooking({ bookingId }), "Booking cancelled");
              }
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {showCash && (
        <form onSubmit={handleCash} className="flex flex-wrap items-end gap-2">
          <div className="w-28">
            <label className="label">Amount ($)</label>
            <input
              name="amount"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={(serviceTotalCents / 100).toString()}
              className="input"
            />
          </div>
          <div className="w-24">
            <label className="label">Tip ($)</label>
            <input name="tip" type="number" min={0} step="0.01" defaultValue="0" className="input" />
          </div>
          <div className="min-w-48 flex-1">
            <label className="label">Proof photo URL</label>
            <input name="proofUrl" type="url" required placeholder="https://…" className="input" />
          </div>
          <button type="submit" className="btn-gold" disabled={busy}>
            Record
          </button>
        </form>
      )}
    </div>
  );
}
