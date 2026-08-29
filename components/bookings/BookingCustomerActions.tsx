"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  cancelBooking,
  getBookingSlots,
  rescheduleBooking,
} from "@/actions/bookings";
import { confirmDirectPayment } from "@/actions/payments";
import BookingCalendar from "@/components/bookings/BookingCalendar";
import PaymentPanel from "@/components/bookings/PaymentPanel";
import TimeSlotPicker from "@/components/bookings/TimeSlotPicker";
import { formatCents } from "@/lib/constants";
import type {
  BookingStatus,
  CustomerPaymentMethod,
  TimeSlot,
} from "@/types";

const TIP_PERCENTS = [0, 10, 15, 20] as const;

// The customer's side of a booking.
//
// There is no card checkout here and there never will be: the job is paid
// directly to the professional, and CheersJA only records that it happened. What
// this screen does is confirm the booking, show the professional's own payment
// details (only to this customer, only once confirmed), and let the customer
// say they have paid so the professional can confirm it.
export default function BookingCustomerActions({
  bookingId,
  workerId,
  professionalName,
  durationMinutes,
  status,
  canCancel,
  serviceTotalCents,
  paymentMethods,
  committedTipCents = 0,
  paymentClaimed = false,
  paymentRecorded = false,
}: {
  bookingId: string;
  workerId: string;
  professionalName: string;
  durationMinutes: number;
  status: BookingStatus;
  canCancel: boolean;
  serviceTotalCents: number;
  // The ways THIS booking may be paid — the gig's allowlist if it has one,
  // otherwise every active method the professional has (lib/payment-methods.ts
  // methodsForGig). Passed only for this booking's customer, only once
  // confirmed; empty at every other time.
  paymentMethods: CustomerPaymentMethod[];
  committedTipCents?: number;
  paymentClaimed?: boolean;
  paymentRecorded?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  // Bumped to force a slot refetch (losing a booking race, reopening the
  // reschedule form).
  const [slotsVersion, setSlotsVersion] = useState(0);
  // The slot board is keyed by what it was fetched for; `slots` and the
  // loading flag are derived from whether the stored result matches the
  // current key, so nothing is set synchronously inside the effect.
  const slotsKey =
    showReschedule && newDate
      ? `${newDate}|${durationMinutes}|${slotsVersion}`
      : null;
  const [slotsResult, setSlotsResult] = useState<{
    key: string;
    slots: TimeSlot[];
  } | null>(null);
  const slots =
    slotsKey !== null && slotsResult?.key === slotsKey ? slotsResult.slots : null;
  const slotsLoading = slotsKey !== null && slots === null;

  useEffect(() => {
    if (slotsKey === null) return;
    let stale = false;
    getBookingSlots({
      workerId,
      date: newDate,
      durationMinutes,
      excludeBookingId: bookingId,
    }).then((res) => {
      if (stale) return;
      if (res.ok) {
        setSlotsResult({ key: slotsKey, slots: res.data.slots });
        setNewTime((t) =>
          res.data.slots.some((s) => s.time === t && s.state === "available")
            ? t
            : ""
        );
      } else {
        setSlotsResult({ key: slotsKey, slots: [] });
        toast.error(res.error);
      }
    });
    return () => {
      stale = true;
    };
  }, [slotsKey, newDate, workerId, durationMinutes, bookingId]);

  const tipCents = Math.round((serviceTotalCents * tipPercent) / 100);
  const dueCents = serviceTotalCents + committedTipCents;
  const cancellable =
    (status === "pending" || status === "accepted" || status === "confirmed") &&
    canCancel;
  const reschedulable =
    status === "pending" || status === "accepted" || status === "confirmed";
  const owing =
    (status === "confirmed" || status === "in_progress") && !paymentRecorded;

  async function handleConfirm() {
    setBusy(true);
    const res = await confirmDirectPayment({ bookingId, tipCents });
    setBusy(false);
    if (res.ok) {
      toast.success("Booking confirmed");
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
    if (!newTime) {
      toast.error("Pick an available time slot.");
      return;
    }
    setBusy(true);
    const res = await rescheduleBooking({
      bookingId,
      date: newDate,
      startTime: newTime,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Booking rescheduled");
      setShowReschedule(false);
      router.refresh();
    } else {
      toast.error(res.error);
      // Lost a race for the slot — reload the board.
      setNewTime("");
      setSlotsVersion((v) => v + 1);
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
            Accepted — confirm to lock in your booking. You&apos;ll pay{" "}
            {professionalName} directly; CheersJA never holds your money.
          </p>
          <div className="mt-4">
            <p className="label">
              Add a tip? (100% goes to your professional)
            </p>
            <div className="flex gap-2">
              {TIP_PERCENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTipPercent(p)}
                  className={`btn px-4 py-2 text-xs ${
                    tipPercent === p
                      ? "bg-brand text-base"
                      : "border border-hairline text-muted"
                  }`}
                >
                  {p === 0 ? "No tip" : `${p}%`}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="btn-primary w-full"
            >
              {busy
                ? "Working…"
                : `Confirm booking — ${formatCents(serviceTotalCents + tipCents)} payable to ${professionalName}`}
            </button>
            <p className="mt-2 text-center text-xs text-faint">
              Their payment details appear here as soon as you confirm.
            </p>
          </div>
        </div>
      )}

      {owing && (
        <PaymentPanel
          bookingId={bookingId}
          professionalName={professionalName}
          amountCents={dueCents}
          methods={paymentMethods}
          claimed={paymentClaimed}
        />
      )}

      {paymentRecorded && status !== "pending" && (
        <p className="text-sm text-success">
          {professionalName} has confirmed your payment of{" "}
          {formatCents(dueCents)}.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {reschedulable && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setShowReschedule((v) => !v);
              setSlotsVersion((v) => v + 1);
            }}
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
        <form onSubmit={handleReschedule} className="space-y-3">
          <div>
            <p className="label">New date</p>
            <BookingCalendar
              workerId={workerId}
              durationMinutes={durationMinutes}
              excludeBookingId={bookingId}
              value={newDate}
              onSelect={setNewDate}
            />
          </div>
          <div>
            <p className="label">New time</p>
            <TimeSlotPicker
              slots={slots}
              loading={slotsLoading}
              dateSelected={Boolean(newDate)}
              value={newTime}
              onSelect={setNewTime}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy || !newTime}>
            Confirm
          </button>
        </form>
      )}
    </div>
  );
}
