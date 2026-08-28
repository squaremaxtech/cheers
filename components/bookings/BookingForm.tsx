"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createBooking, getBookingSlots } from "@/actions/bookings";
import LocationPicker from "@/components/maps/LocationPicker";
import BookingCalendar from "@/components/bookings/BookingCalendar";
import TimeSlotPicker from "@/components/bookings/TimeSlotPicker";
import { BOOKING_DURATIONS_MINUTES, formatCents } from "@/lib/constants";
import type { TimeSlot } from "@/types";

// The shape the book page passes in — a fixed-price gig with its add-ons
// (structurally a subset of lib/gigs' PublicGigWithAddons).
type GigOption = {
  id: string;
  title: string;
  categoryName: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  addons: {
    id: string;
    name: string;
    priceCents: number;
    description: string | null;
  }[];
};

export default function BookingForm({
  workerId,
  gigs,
  initialGigId,
}: {
  workerId: string;
  gigs: GigOption[];
  // Preselects the gig the customer chose on the profile page (?gig=).
  initialGigId?: string;
}) {
  const router = useRouter();
  const initialGig = gigs.find((g) => g.id === initialGigId) ?? gigs[0];
  const [gigId, setGigId] = useState(initialGig?.id ?? "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(initialGig?.durationMinutes ?? 60);
  // Bumped to force a slot refetch after losing a booking race.
  const [slotsVersion, setSlotsVersion] = useState(0);
  // The slot board is keyed by what it was fetched for; `slots` and the
  // loading flag are derived from whether the stored result matches the
  // current key, so nothing is set synchronously inside the effect.
  const slotsKey = date ? `${date}|${duration}|${slotsVersion}` : null;
  const [slotsResult, setSlotsResult] = useState<{
    key: string;
    slots: TimeSlot[];
  } | null>(null);
  const slots =
    slotsKey !== null && slotsResult?.key === slotsKey ? slotsResult.slots : null;
  const slotsLoading = slotsKey !== null && slots === null;
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat?: string; lng?: string }>({});
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedGig = gigs.find((g) => g.id === gigId);
  const availableAddons = useMemo(
    () => selectedGig?.addons ?? [],
    [selectedGig]
  );
  const selectedAddons = availableAddons.filter((a) =>
    addonIds.some((id) => id === a.id)
  );
  const total =
    (selectedGig?.priceCents ?? 0) +
    selectedAddons.reduce((sum, a) => sum + a.priceCents, 0);

  const handleAddress = useCallback(
    (value: string, lat?: string, lng?: string) => {
      setAddress(value);
      setCoords({ lat, lng });
    },
    []
  );

  useEffect(() => {
    if (slotsKey === null) return;
    let stale = false;
    getBookingSlots({ workerId, date, durationMinutes: duration }).then((res) => {
      if (stale) return;
      if (res.ok) {
        setSlotsResult({ key: slotsKey, slots: res.data.slots });
        // Drop a selection that is no longer offered/available.
        setStartTime((t) =>
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
  }, [slotsKey, workerId, date, duration]);

  if (gigs.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        This professional has no bookable gigs right now. Gigs priced per job
        are booked by requesting a quote from their profile.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!startTime) {
      toast.error("Pick an available time slot.");
      return;
    }
    setSubmitting(true);
    const res = await createBooking({
      workerId,
      gigId,
      date,
      startTime,
      durationMinutes: duration,
      address,
      lat: coords.lat,
      lng: coords.lng,
      instructions: instructions || undefined,
      addonIds,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Booking request sent");
      router.push(`/bookings/${res.data.bookingId}`);
    } else {
      toast.error(res.error);
      // The server re-checks the slot on submit — if we lost the race, show
      // the fresh board so the customer picks another time.
      setSlotsVersion((v) => v + 1);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Gig */}
      <fieldset className="card p-5">
        <legend className="label px-1">Gig</legend>
        <div className="space-y-2">
          {gigs.map((g) => (
            <label
              key={g.id}
              className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition-colors ${
                gigId === g.id
                  ? "border-gold/60 bg-raised"
                  : "border-hairline hover:border-brand/30"
              }`}
            >
              <span>
                <input
                  type="radio"
                  name="gig"
                  className="mr-2 accent-[var(--color-brand)]"
                  checked={gigId === g.id}
                  onChange={() => {
                    setGigId(g.id);
                    setAddonIds([]);
                    setDuration(g.durationMinutes);
                  }}
                />
                <span className="text-sm font-medium text-ink">{g.title}</span>
                <span className="ml-2 text-[11px] uppercase tracking-wider text-faint">
                  {g.categoryName}
                </span>
                {g.description && (
                  <span className="mt-1 block pl-6 text-xs leading-5 text-muted">
                    {g.description}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-gold-deep">
                {formatCents(g.priceCents)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Add-ons */}
      {availableAddons.length > 0 && (
        <fieldset className="card p-5">
          <legend className="label px-1">Add-ons (optional)</legend>
          <div className="space-y-2">
            {availableAddons.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-hairline p-3 text-sm hover:border-brand/30"
              >
                <span>
                  <input
                    type="checkbox"
                    className="mr-2 accent-[var(--color-brand)]"
                    checked={addonIds.some((id) => id === a.id)}
                    onChange={(e) =>
                      setAddonIds((ids) =>
                        e.target.checked
                          ? [...ids, a.id]
                          : ids.filter((id) => id !== a.id)
                      )
                    }
                  />
                  <span className="text-ink">{a.name}</span>
                  {a.description && (
                    <span className="ml-2 text-xs text-faint">
                      {a.description}
                    </span>
                  )}
                </span>
                <span className="text-gold-deep">+{formatCents(a.priceCents)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* When */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">When</legend>
        <div>
          <label className="label" htmlFor="b-duration">
            Duration
          </label>
          <select
            id="b-duration"
            className="input sm:max-w-56"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {/* Standard durations plus this gig's own duration */}
            {[...new Set([selectedGig?.durationMinutes ?? 60, ...BOOKING_DURATIONS_MINUTES])]
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  {d < 120 ? `${d} min` : `${d / 60} hours`}
                </option>
              ))}
          </select>
        </div>
        <div>
          <p className="label">Date</p>
          <BookingCalendar
            workerId={workerId}
            durationMinutes={duration}
            value={date}
            onSelect={setDate}
          />
        </div>
        <div>
          <p className="label">Start time</p>
          <TimeSlotPicker
            slots={slots}
            loading={slotsLoading}
            dateSelected={Boolean(date)}
            value={startTime}
            onSelect={setStartTime}
          />
        </div>
      </fieldset>

      {/* Where */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">Where</legend>
        <div>
          <label className="label">Address</label>
          <LocationPicker onChange={handleAddress} />
        </div>
        <div>
          <label className="label" htmlFor="b-instructions">
            Instructions (optional)
          </label>
          <textarea
            id="b-instructions"
            rows={3}
            className="input"
            placeholder="Gate code, dress code, occasion details…"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
      </fieldset>

      {/* Summary */}
      <div className="card p-5">
        <h3 className="label">Summary</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{selectedGig?.title}</dt>
            <dd className="text-ink">
              {formatCents(selectedGig?.priceCents ?? 0)}
            </dd>
          </div>
          {selectedAddons.map((a) => (
            <div key={a.id} className="flex justify-between">
              <dt className="text-muted">{a.name}</dt>
              <dd className="text-ink">{formatCents(a.priceCents)}</dd>
            </div>
          ))}
          <div className="hairline-top mt-2 flex justify-between pt-2 text-[1rem]">
            <dt className="text-ink">Total</dt>
            <dd className="font-medium text-gold-deep">{formatCents(total)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-faint">
          Payment is only collected after your request is accepted. Free
          cancellation up to 5 hours before.
        </p>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Sending request…" : "Send booking request"}
      </button>
    </form>
  );
}
