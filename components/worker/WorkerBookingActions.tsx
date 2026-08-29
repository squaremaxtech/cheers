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
import { recordJobPayment } from "@/actions/payments";
import { formatCents, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import {
  JOB_PAYMENT_METHODS,
  toJobPaymentMethod,
  type JobPaymentMethod,
} from "@/lib/payments/config";
import type { ActionResult, BookingStatus } from "@/types";

// The professional's side of a booking.
//
// The customer pays them directly and they keep every cent of it — recording
// the payment here is the platform's record that the job was paid, nothing
// more. There is no proof upload and no dispute flow behind it: their word is
// the record, because CheersJA never held the money and cannot adjudicate it.
export default function WorkerBookingActions({
  bookingId,
  status,
  serviceTotalCents,
  paymentClaim = null,
  paymentRecorded = false,
}: {
  bookingId: string;
  status: BookingStatus;
  serviceTotalCents: number;
  // What the customer said they did, if anything — a prompt, not proof.
  paymentClaim?: { method: string; note: string | null } | null;
  paymentRecorded?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [method, setMethod] = useState<JobPaymentMethod>(
    toJobPaymentMethod(paymentClaim?.method)
  );

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

  async function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await recordJobPayment({
      bookingId,
      method,
      tipCents: Math.round(Number(form.get("tip") ?? 0) * 100),
      note: form.get("note"),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Payment recorded");
      setShowPayment(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const canRecord =
    !paymentRecorded &&
    (status === "accepted" || status === "confirmed" || status === "in_progress");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <>
            <button
              type="button"
              className="btn-primary"
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

        {canRecord && (
          <button
            type="button"
            className={paymentClaim ? "btn-primary" : "btn-outline"}
            disabled={busy}
            onClick={() => setShowPayment((v) => !v)}
          >
            Confirm payment received
          </button>
        )}

        {status === "in_progress" && (
          <button
            type="button"
            className="btn-primary"
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

      {paymentClaim && !paymentRecorded && (
        <p className="text-xs text-warn">
          The customer says they paid by{" "}
          {JOB_PAYMENT_METHODS.find((m) => m.value === paymentClaim.method)
            ?.label ?? paymentClaim.method}
          {paymentClaim.note ? ` — “${paymentClaim.note}”` : ""}. Confirm it
          once the money is actually in hand.
        </p>
      )}

      {status === "confirmed" && !paymentRecorded && (
        <p className="text-xs text-muted">
          The customer pays you directly — you keep every cent. Confirm it here
          once it&apos;s in hand. Enter the customer&apos;s PIN in the booking
          room to start the session; completing needs a PIN-verified start and
          a recorded payment.
        </p>
      )}

      {paymentRecorded && (
        <p className="text-xs text-success">
          Payment recorded. The {PLATFORM_FEE_PERCENT}% commission on this job
          goes on your monthly statement — nothing is deducted from what you
          were paid.
        </p>
      )}

      {showPayment && canRecord && (
        <form onSubmit={handlePayment} className="space-y-3">
          <p className="text-xs text-muted">
            You collected {formatCents(serviceTotalCents)} plus any tip. The
            service amount is fixed — enter only the tip you actually received.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="pay-method">
                How were you paid?
              </label>
              <select
                id="pay-method"
                className="input"
                value={method}
                onChange={(e) => setMethod(toJobPaymentMethod(e.target.value))}
              >
                {JOB_PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pay-tip">
                Tip ($)
              </label>
              <input
                id="pay-tip"
                name="tip"
                type="number"
                min={0}
                step="0.01"
                defaultValue="0"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="pay-note">
                Reference (optional)
              </label>
              <input
                id="pay-note"
                name="note"
                className="input"
                maxLength={300}
                placeholder="Transfer ref, or a note"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Confirm payment received"}
          </button>
        </form>
      )}
    </div>
  );
}
