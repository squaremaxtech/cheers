"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useJsApiLoader } from "@react-google-maps/api";
import toast from "react-hot-toast";
import { requestRide } from "@/actions/rides";
import LocationPicker from "@/components/maps/LocationPicker";
import {
  distanceMeters,
  formatDistance,
  hasMapsKey,
  mapsApiKey,
  mapsLibraries,
  parseLatLng,
} from "@/components/maps/mapConfig";
import {
  formatCents,
  RIDE_BASE_FARE_CENTS,
  RIDE_PER_KM_CENTS,
} from "@/lib/constants";

type Point = { address: string; lat?: string; lng?: string };

// Client-side mirror of lib/rides.ts suggestedFareCents (that module pulls in
// db/crypto, so it can't be imported here). The server recomputes the
// canonical figure from distanceM on submit — this is only the on-screen hint.
function suggestFareCents(distanceM: number): number {
  const km = distanceM / 1000;
  return Math.max(
    RIDE_BASE_FARE_CENTS,
    Math.round(RIDE_BASE_FARE_CENTS + km * RIDE_PER_KM_CENTS)
  );
}

// "Now" as Jamaica wall-clock in datetime-local format (UTC-5, no DST) — the
// schedule input's floor, matching how the server parses it (parseRideTime).
function jamaicaNowLocal(): string {
  return new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 16);
}

// The inDrive move: pickup + dropoff, an optional schedule, and the rider's
// OWN price. Drivers accept it as-is or counter; nothing is charged here —
// rides settle in cash with the driver.
export default function RideRequestForm({
  bookingId,
  prefillDropoff,
}: {
  // Optional link to a gig booking this ride serves (?bookingId=…).
  bookingId?: string;
  // Server-verified dropoff prefill: that booking's address (only passed when
  // the viewer is the booking's customer or worker).
  prefillDropoff?: { address: string; lat?: string; lng?: string; code?: string };
}) {
  const router = useRouter();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    libraries: mapsLibraries,
  });

  const [pickup, setPickup] = useState<Point>({ address: "" });
  const [dropoff, setDropoff] = useState<Point>(
    prefillDropoff
      ? {
          address: prefillDropoff.address,
          lat: prefillDropoff.lat,
          lng: prefillDropoff.lng,
        }
      : { address: "" }
  );
  // Prefilled dropoff renders as a summary card until the rider asks to change it.
  const [editingDropoff, setEditingDropoff] = useState(!prefillDropoff);
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [offer, setOffer] = useState("");
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastRouteKey = useRef("");

  const pickupPoint = parseLatLng(pickup.lat, pickup.lng);
  const dropoffPoint = parseLatLng(dropoff.lat, dropoff.lng);
  const routeKey =
    pickupPoint && dropoffPoint
      ? `${pickupPoint.lat},${pickupPoint.lng}->${dropoffPoint.lat},${dropoffPoint.lng}`
      : "";

  // Route distance for the fare hint: Google Directions when the API is
  // loaded, straight-line haversine as an instant fallback.
  useEffect(() => {
    if (!routeKey || !pickupPoint || !dropoffPoint) {
      lastRouteKey.current = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale distance when the route goes away
      setDistanceM(null);
      return;
    }
    if (routeKey === lastRouteKey.current) return;
    lastRouteKey.current = routeKey;
    setDistanceM(Math.round(distanceMeters(pickupPoint, dropoffPoint)));
    if (!isLoaded || !hasMapsKey()) return;
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: pickupPoint,
        destination: dropoffPoint,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        const meters = result?.routes[0]?.legs?.reduce(
          (sum, leg) => sum + (leg.distance?.value ?? 0),
          0
        );
        if (status === "OK" && meters) setDistanceM(meters);
      }
    );
  }, [routeKey, isLoaded, pickupPoint, dropoffPoint]);

  const suggested = distanceM !== null ? suggestFareCents(distanceM) : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const offerCents = Math.round(Number(offer) * 100);
    if (!Number.isFinite(offerCents) || offerCents < 100) {
      toast.error("Offer at least $1.00 for the trip.");
      return;
    }
    if (schedule && !scheduledAt) {
      toast.error("Pick a pickup time, or switch back to ASAP.");
      return;
    }
    setSubmitting(true);
    const res = await requestRide({
      pickupAddress: pickup.address,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffAddress: dropoff.address,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      scheduledAt: schedule && scheduledAt ? scheduledAt : undefined,
      offerCents,
      distanceM: distanceM ?? undefined,
      bookingId,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Request posted — drivers are being notified.");
      router.push(`/rides/${res.data.rideId}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Route */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">Route</legend>
        <div>
          <label className="label">Pickup</label>
          <LocationPicker
            placeholder="Where should the driver meet you?"
            onChange={(address, lat, lng) => setPickup({ address, lat, lng })}
          />
        </div>
        <div>
          <label className="label">Drop-off</label>
          {editingDropoff ? (
            <LocationPicker
              placeholder="Where are you going?"
              onChange={(address, lat, lng) => setDropoff({ address, lat, lng })}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-raised px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{dropoff.address}</p>
                {prefillDropoff?.code && (
                  <p className="mt-0.5 text-xs text-faint">
                    From booking {prefillDropoff.code}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0 text-xs"
                onClick={() => {
                  setEditingDropoff(true);
                  setDropoff({ address: "" });
                }}
              >
                Change
              </button>
            </div>
          )}
        </div>
        {distanceM !== null && (
          <p className="text-xs text-muted">
            Route distance: about {formatDistance(distanceM)}
          </p>
        )}
      </fieldset>

      {/* When */}
      <fieldset className="card space-y-3 p-5">
        <legend className="label px-1">When</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={schedule ? "btn-outline" : "btn-primary"}
            onClick={() => setSchedule(false)}
          >
            As soon as possible
          </button>
          <button
            type="button"
            className={schedule ? "btn-primary" : "btn-outline"}
            onClick={() => setSchedule(true)}
          >
            Schedule for later
          </button>
        </div>
        {schedule && (
          <div>
            <label className="label" htmlFor="ride-when">
              Pickup time (Jamaica time)
            </label>
            <input
              id="ride-when"
              type="datetime-local"
              className="input sm:max-w-64"
              min={jamaicaNowLocal()}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        )}
      </fieldset>

      {/* The rider's price */}
      <fieldset className="card space-y-3 p-5">
        <legend className="label px-1">Your offer</legend>
        <div>
          <label className="label" htmlFor="ride-offer">
            What will you pay for this trip? (USD)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="ride-offer"
              type="number"
              min={1}
              step="0.01"
              inputMode="decimal"
              required
              className="input sm:max-w-40"
              placeholder="10.00"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
            />
            {suggested !== null && (
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setOffer((suggested / 100).toFixed(2))}
              >
                Suggested: {formatCents(suggested)}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-faint">
            Name your price — drivers accept it instantly or counter with their
            own. Rides are paid in cash, directly to the driver.
          </p>
        </div>
      </fieldset>

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Posting request…" : "Request ride"}
      </button>
    </form>
  );
}
