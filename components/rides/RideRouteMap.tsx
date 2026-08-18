"use client";

import { useEffect, useRef, useState } from "react";
import {
  DirectionsRenderer,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import {
  hasMapsKey,
  mapsApiKey,
  mapsLibraries,
  type LatLng,
} from "@/components/maps/mapConfig";

// Ride-room map: pickup and dropoff pins plus the driving route between them.
// Renders nothing without a maps key or coordinates — the room's address text
// is the source of truth; this is a visual aid.
export default function RideRouteMap({
  pickup,
  dropoff,
}: {
  pickup: LatLng | null;
  dropoff: LatLng | null;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    libraries: mapsLibraries,
  });

  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!isLoaded || !pickup || !dropoff || requested.current) return;
    requested.current = true;
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setDirections(status === "OK" ? result : null);
      }
    );
  }, [isLoaded, pickup, dropoff]);

  if (!hasMapsKey() || !pickup || !dropoff) return null;
  if (!isLoaded) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-hairline text-sm text-faint">
        Loading map…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "240px" }}
        center={pickup}
        zoom={12}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        <Marker position={pickup} label="A" title="Pickup" />
        <Marker position={dropoff} label="B" title="Drop-off" />
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{ suppressMarkers: true }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
