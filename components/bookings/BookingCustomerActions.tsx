"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cancelBooking, rescheduleBooking } from "@/actions/bookings";
import { chooseCashPayment, createBookingCheckout } from "@/actions/payments";
import { formatCents } from "@/lib/constants";
import type { BookingStatus } from "@/types";

const TIP_PERCENTS = [0, 10, 15, 20] as const;

export default function BookingCustomerActions({
  bookingId,
  status,
  canCancel,
  serviceTotalCents,
  stripeConfigured,
}: {
  bookingId: string;
  status: BookingStatus;
  canCancel: boolean;
  serviceTotalCents: number;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [showReschedule, setShowReschedule] = useState(false);

  const tipCents = Math.round((serviceTotalCents * tipPercent) / 100);
  const cancellable =
    (status === "pending" || status === "accepted" || status === "confirmed") &&
    canCancel;
  const reschedulable =
    status === "pending" || status === "accepted" || status === "confirmed";

  async function handlePayCard() {
    setBusy(true);
    const res = await createBookingCheckout({ bookingId, tipCents });
    if (res.ok) {
      window.location.href = res.data.url;
    } else {
      setBusy(false);
      toast.error(res.error);
    }
  }

  async function handlePayCash() {
    setBusy(true);
    const res = await chooseCashPayment({ bookingId, tipCents });
    setBusy(false);
    if (res.ok) {
      toast.success("Confirmed — pay cash at your meeting");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this booking?")) return;
    setBusy(true);
    const res = await cancelBooking({ bookingId });
    setBusy(false);
    if (res.ok) {
      toast.success("Booking cancelled");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleReschedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await rescheduleBooking({
      bookingId,
      date: form.get("date"),
      startTime: form.get("startTime"),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Booking rescheduled");
      setShowReschedule(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (
    status === "completed" ||
    status === "declined" ||
    status === "cancelled" ||
    status === "refunded"
  ) {
    return null;
  }

  return (
    <div className="card space-y-4 p-6">
      {status === "pending" && (
        <p className="text-sm text-muted">
          Waiting for acceptance — we&apos;ll email you the moment it&apos;s
          confirmed.
        </p>
      )}

      {status === "accepted" && (
        <div>
          <p className="text-sm text-ink">
            Accepted — choose how you&apos;d like to pay to confirm your
            booking.
          </p>
          <div className="mt-4">
            <p className="label">Add a tip? (100% goes to your worker)</p>
            <div className="flex gap-2">
              {TIP_PERCENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTipPercent(p)}
                  className={`btn px-4 py-2 text-xs ${
                    tipPercent === p
                      ? "bg-gold text-base"
                      : "border border-hairline text-muted"
                  }`}
                >
                  {p === 0 ? "No tip" : `${p}%`}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {stripeConfigured && (
              <button
                type="button"
                onClick={handlePayCard}
                disabled={busy}
                className="btn-gold w-full"
              >
                {busy
                  ? "Working…"
                  : `Pay ${formatCents(serviceTotalCents + tipCents)} by card`}
              </button>
            )}
            <button
              type="button"
              onClick={handlePayCash}
              disabled={busy}
              className={stripeConfigured ? "btn-outline w-full" : "btn-gold w-full"}
            >
              {busy
                ? "Working…"
                : `Pay ${formatCents(serviceTotalCents + tipCents)} cash at meeting`}
            </button>
            <p className="text-center text-xs text-faint">
              Cash bookings confirm instantly — have the exact amount ready.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {reschedulable && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => setShowReschedule((v) => !v)}
          >
            Reschedule
          </button>
        )}
        {cancellable ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="btn-danger"
          >
            Cancel booking
          </button>
        ) : (
          status !== "pending" && (
            <p className="self-center text-xs text-faint">
              Free cancellation closes 5 hours before start.
            </p>
          )
        )}
      </div>

      {showReschedule && (
        <form onSubmit={handleReschedule} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="r-date">
              New date
            </label>
            <input
              id="r-date"
              name="date"
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="r-time">
              New time
            </label>
            <input id="r-time" name="startTime" type="time" required className="input" />
          </div>
          <button type="submit" className="btn-gold" disabled={busy}>
            Confirm
          </button>
        </form>
      )}
    </div>
  );
}
