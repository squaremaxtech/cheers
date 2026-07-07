"use client";

import { useEffect, useRef, useState } from "react";
import {
  DirectionsRenderer,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import {
  defaultMapCenter,
  distanceMeters,
  formatDistance,
  hasMapsKey,
  mapsApiKey,
  mapsLibraries,
  type LatLng,
} from "@/components/maps/mapConfig";

export type MapParticipant = {
  key: string;
  label: string; // marker letter, e.g. "W" worker, "C" customer, "D" driver
  title: string;
  position: LatLng;
};

// Booking-room map: destination pin, live participant pins, and (when the
// viewer shares their own location) a driving route + distance from the
// viewer to the destination.
export default function BookingRouteMap({
  destination,
  participants,
  origin,
}: {
  destination: LatLng | null;
  participants: MapParticipant[];
  origin: LatLng | null;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    libraries: mapsLibraries,
  });

  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const lastRouteKey = useRef("");

  // ~11 m grid: don't re-query Directions for every GPS jitter.
  const routeKey =
    origin && destination
      ? `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat},${destination.lng}`
      : "";

  useEffect(() => {
    if (!isLoaded || !routeKey || !origin || !destination) {
      setDirections(null);
      lastRouteKey.current = "";
      return;
    }
    if (routeKey === lastRouteKey.current) return;
    lastRouteKey.current = routeKey;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setDirections(status === "OK" ? result : null);
      }
    );
  }, [isLoaded, routeKey, origin, destination]);

  if (!hasMapsKey()) {
    return (
      <div className="card flex h-48 items-center justify-center p-4 text-center text-sm text-faint">
        Map unavailable — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="card flex h-48 items-center justify-center text-sm text-faint">
        Loading map…
      </div>
    );
  }

  const center =
    destination ?? origin ?? participants[0]?.position ?? defaultMapCenter;
  const straightLine =
    origin && destination ? distanceMeters(origin, destination) : null;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-hairline">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "300px" }}
          center={center}
          zoom={13}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          {destination && (
            <Marker position={destination} label="B" title="Booking location" />
          )}
          {participants.map((p) => (
            <Marker
              key={p.key}
              position={p.position}
              label={p.label}
              title={p.title}
            />
          ))}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{ suppressMarkers: true }}
            />
          )}
        </GoogleMap>
      </div>
      {straightLine !== null && (
        <p className="mt-2 text-xs text-muted">
          You are {formatDistance(straightLine)} from the booking location.
        </p>
      )}
    </div>
  );
}
