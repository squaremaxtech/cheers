"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createBooking, getBookingSlots } from "@/actions/bookings";
import LocationPicker from "@/components/maps/LocationPicker";
import BookingCalendar from "@/components/bookings/BookingCalendar";
import TimeSlotPicker from "@/components/bookings/TimeSlotPicker";
import { BOOKING_DURATIONS_MINUTES, formatCents } from "@/lib/constants";
import type { ServiceAddonRow, TimeSlot } from "@/types";

type ServiceOption = {
  workerServiceId: string;
  serviceTypeId: string;
  priceCents: number;
  durationMinutes: number;
  description: string | null;
  name: string;
  categoryName: string;
};

export default function BookingForm({
  workerId,
  services,
  addons,
  initialServiceTypeId,
}: {
  workerId: string;
  services: ServiceOption[];
  addons: ServiceAddonRow[];
  // Preselects the service the customer chose on the profile page (?service=).
  initialServiceTypeId?: string;
}) {
  const router = useRouter();
  const initialService =
    services.find((s) => s.serviceTypeId === initialServiceTypeId) ??
    services[0];
  const [serviceTypeId, setServiceTypeId] = useState(
    initialService?.serviceTypeId ?? ""
  );
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(
    initialService?.durationMinutes ?? 60
  );
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat?: string; lng?: string }>({});
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedService = services.find(
    (s) => s.serviceTypeId === serviceTypeId
  );
  const availableAddons = useMemo(
    () =>
      addons.filter(
        (a) => a.workerServiceId === selectedService?.workerServiceId
      ),
    [addons, selectedService]
  );
  const selectedAddons = availableAddons.filter((a) =>
    addonIds.some((id) => id === a.id)
  );
  const total =
    (selectedService?.priceCents ?? 0) +
    selectedAddons.reduce((sum, a) => sum + a.priceCents, 0);

  const handleAddress = useCallback(
    (value: string, lat?: string, lng?: string) => {
      setAddress(value);
      setCoords({ lat, lng });
    },
    []
  );

  const refreshSlots = useCallback(async () => {
    if (!date) {
      setSlots(null);
      return;
    }
    setSlotsLoading(true);
    const res = await getBookingSlots({
      workerId,
      date,
      durationMinutes: duration,
    });
    setSlotsLoading(false);
    if (res.ok) {
      setSlots(res.data.slots);
      // Drop a selection that is no longer offered/available.
      setStartTime((t) =>
        res.data.slots.some((s) => s.time === t && s.state === "available")
          ? t
          : ""
      );
    } else {
      setSlots([]);
      toast.error(res.error);
    }
  }, [workerId, date, duration]);

  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  if (services.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        This worker has no bookable services right now.
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
      serviceTypeId,
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
      void refreshSlots();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Service */}
      <fieldset className="card p-5">
        <legend className="label px-1">Service</legend>
        <div className="space-y-2">
          {services.map((s) => (
            <label
              key={s.serviceTypeId}
              className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition-colors ${
                serviceTypeId === s.serviceTypeId
                  ? "border-gold/60 bg-raised"
                  : "border-hairline hover:border-gold/30"
              }`}
            >
              <span>
                <input
                  type="radio"
                  name="service"
                  className="mr-2 accent-[var(--color-gold)]"
                  checked={serviceTypeId === s.serviceTypeId}
                  onChange={() => {
                    setServiceTypeId(s.serviceTypeId);
                    setAddonIds([]);
                    setDuration(s.durationMinutes);
                  }}
                />
                <span className="text-sm font-medium text-ink">{s.name}</span>
                <span className="ml-2 text-[11px] uppercase tracking-wider text-faint">
                  {s.categoryName}
                </span>
                {s.description && (
                  <span className="mt-1 block pl-6 text-xs leading-5 text-muted">
                    {s.description}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-gold">
                {formatCents(s.priceCents)}
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
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-hairline p-3 text-sm hover:border-gold/30"
              >
                <span>
                  <input
                    type="checkbox"
                    className="mr-2 accent-[var(--color-gold)]"
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
                <span className="text-gold">+{formatCents(a.priceCents)}</span>
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
            {/* Standard durations plus this service's own duration */}
            {[...new Set([selectedService?.durationMinutes ?? 60, ...BOOKING_DURATIONS_MINUTES])]
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
            <dt className="text-muted">{selectedService?.name}</dt>
            <dd className="text-ink">
              {formatCents(selectedService?.priceCents ?? 0)}
            </dd>
          </div>
          {selectedAddons.map((a) => (
            <div key={a.id} className="flex justify-between">
              <dt className="text-muted">{a.name}</dt>
              <dd className="text-ink">{formatCents(a.priceCents)}</dd>
            </div>
          ))}
          <div className="hairline-top mt-2 flex justify-between pt-2 text-base">
            <dt className="text-ink">Total</dt>
            <dd className="font-medium text-gold">{formatCents(total)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-faint">
          Payment is only collected after your request is accepted. Free
          cancellation up to 5 hours before.
        </p>
      </div>

      <button type="submit" className="btn-gold w-full" disabled={submitting}>
        {submitting ? "Sending request…" : "Send booking request"}
      </button>
    </form>
  );
}
