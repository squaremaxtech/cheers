"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  cancelBooking,
  getBookingSlots,
  rescheduleBooking,
} from "@/actions/bookings";
import { chooseCashPayment, createBookingCheckout } from "@/actions/payments";
import BookingCalendar from "@/components/bookings/BookingCalendar";
import TimeSlotPicker from "@/components/bookings/TimeSlotPicker";
import { formatCents } from "@/lib/constants";
import type { BookingStatus, TimeSlot } from "@/types";

const TIP_PERCENTS = [0, 10, 15, 20] as const;

export default function BookingCustomerActions({
  bookingId,
  workerId,
  durationMinutes,
  status,
  canCancel,
  serviceTotalCents,
  stripeConfigured,
  cashPending = false,
  committedTipCents = 0,
}: {
  bookingId: string;
  workerId: string;
  durationMinutes: number;
  status: BookingStatus;
  canCancel: boolean;
  serviceTotalCents: number;
  stripeConfigured: boolean;
  // A confirmed cash-at-meeting booking whose cash hasn't been collected yet
  // may still switch to card (until the session starts).
  cashPending?: boolean;
  committedTipCents?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  // Bumped to force a slot refetch after losing a booking race.
  const [slotsVersion, setSlotsVersion] = useState(0);

  useEffect(() => {
    if (!showReschedule || !newDate) {
      setSlots(null);
      return;
    }
    let stale = false;
    setSlotsLoading(true);
    getBookingSlots({
      workerId,
      date: newDate,
      durationMinutes,
      excludeBookingId: bookingId,
    }).then((res) => {
      if (stale) return;
      setSlotsLoading(false);
      if (res.ok) {
        setSlots(res.data.slots);
        setNewTime((t) =>
          res.data.slots.some((s) => s.time === t && s.state === "available")
            ? t
            : ""
        );
      } else {
        setSlots([]);
        toast.error(res.error);
      }
    });
    return () => {
      stale = true;
    };
  }, [showReschedule, newDate, workerId, durationMinutes, bookingId, slotsVersion]);

  const tipCents = Math.round((serviceTotalCents * tipPercent) / 100);
  const cancellable =
    (status === "pending" || status === "accepted" || status === "confirmed") &&
    canCancel;
  const reschedulable =
    status === "pending" || status === "accepted" || status === "confirmed";

  async function handlePayCard(chosenTipCents: number) {
    setBusy(true);
    const res = await createBookingCheckout({
      bookingId,
      tipCents: chosenTipCents,
    });
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
                onClick={() => handlePayCard(tipCents)}
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

      {status === "confirmed" && cashPending && stripeConfigured && (
        <div>
          <p className="text-sm text-muted">
            Paying cash at the meeting. Changed your mind? You can switch to
            card any time before the session starts.
          </p>
          <button
            type="button"
            onClick={() => handlePayCard(committedTipCents)}
            disabled={busy}
            className="btn-outline mt-3"
          >
            {busy
              ? "Working…"
              : `Pay ${formatCents(serviceTotalCents + committedTipCents)} by card instead`}
          </button>
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
          <button type="submit" className="btn-gold" disabled={busy || !newTime}>
            Confirm
          </button>
        </form>
      )}
    </div>
  );
}
