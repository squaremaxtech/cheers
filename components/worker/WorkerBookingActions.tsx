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
import { recordCashCollected } from "@/actions/payments";
import FileUploadButton from "@/components/ui/FileUploadButton";
import { formatCents } from "@/lib/constants";
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
  const [proofUrl, setProofUrl] = useState("");

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
    if (!proofUrl) {
      toast.error("Upload a photo of the collected cash / receipt first.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await recordCashCollected({
      bookingId,
      tipCents: Math.round(Number(form.get("tip") ?? 0) * 100),
      proofUrl,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Cash collection recorded");
      setShowCash(false);
      setProofUrl("");
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

        {(status === "accepted" ||
          status === "confirmed" ||
          status === "in_progress") && (
          <button
            type="button"
            className="btn-outline"
            disabled={busy}
            onClick={() => setShowCash((v) => !v)}
          >
            Record cash collected
          </button>
        )}

        {status === "in_progress" && (
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

      {status === "confirmed" && (
        <p className="text-xs text-muted">
          If the customer is paying cash, collect it and record it here (photo
          proof required). Enter the customer&apos;s PIN in the booking room to
          start the session — completing is only possible after a
          PIN-verified start and a recorded payment.
        </p>
      )}

      {showCash && (
        <form onSubmit={handleCash} className="space-y-3">
          <p className="text-xs text-muted">
            Collect {formatCents(serviceTotalCents)} plus any tip. The service
            amount is fixed — enter only the tip you actually received.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-24">
              <label className="label">Tip ($)</label>
              <input
                name="tip"
                type="number"
                min={0}
                step="0.01"
                defaultValue="0"
                className="input"
              />
            </div>
            <FileUploadButton
              label={proofUrl ? "✓ Proof uploaded" : "Upload proof photo"}
              accept="image/jpeg,image/png,image/webp"
              className={proofUrl ? "btn-outline text-success" : "btn-outline"}
              kind="receipt"
              onUploaded={(url) => setProofUrl(url)}
            />
            <button type="submit" className="btn-gold" disabled={busy || !proofUrl}>
              Record collection
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
