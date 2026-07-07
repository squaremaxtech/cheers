"use client";

import { useRef, useState } from "react";
import {
  Autocomplete,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import {
  defaultMapCenter,
  hasMapsKey,
  mapsApiKey,
  mapsLibraries,
  type LatLng,
} from "@/components/maps/mapConfig";

// Address input with Google Places autocomplete (restricted to Jamaica) plus
// a map underneath — pick a suggestion, click the map, or drag the pin.
// Falls back to a plain text input (address only, no coordinates) when no
// maps key is configured.
export default function LocationPicker({
  onChange,
  placeholder = "Street address, area, parish…",
}: {
  onChange: (address: string, lat?: string, lng?: string) => void;
  placeholder?: string;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
    libraries: mapsLibraries,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [text, setText] = useState("");
  const [point, setPoint] = useState<LatLng | null>(null);

  function apply(address: string, p: LatLng | null) {
    setText(address);
    setPoint(p);
    onChange(
      address,
      p ? String(p.lat) : undefined,
      p ? String(p.lng) : undefined
    );
  }

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    const location = place?.geometry?.location;
    if (!place || !location) return;
    apply(place.formatted_address ?? place.name ?? text, {
      lat: location.lat(),
      lng: location.lng(),
    });
  }

  // Clicking the map or dropping the pin reverse-geocodes to a readable
  // address; raw coordinates are the fallback so the booking never loses
  // the picked point.
  async function pickFromMap(e: google.maps.MapMouseEvent) {
    const latLng = e.latLng;
    if (!latLng) return;
    const p = { lat: latLng.lat(), lng: latLng.lng() };
    const fallback = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    geocoderRef.current ??= new google.maps.Geocoder();
    try {
      const res = await geocoderRef.current.geocode({ location: p });
      apply(res.results[0]?.formatted_address ?? fallback, p);
    } catch {
      apply(fallback, p);
    }
  }

  const inputEl = (
    <input
      className="input"
      placeholder={placeholder}
      required
      value={text}
      onChange={(e) => {
        // Manual typing clears the pin — coordinates only come from Google.
        setText(e.target.value);
        setPoint(null);
        onChange(e.target.value);
      }}
    />
  );

  if (!hasMapsKey()) return inputEl;

  return (
    <div className="space-y-3">
      {isLoaded ? (
        <Autocomplete
          onLoad={(ac) => {
            autocompleteRef.current = ac;
          }}
          onPlaceChanged={handlePlaceChanged}
          options={{
            componentRestrictions: { country: "jm" },
            fields: ["geometry", "formatted_address", "name"],
          }}
        >
          {inputEl}
        </Autocomplete>
      ) : (
        inputEl
      )}

      {isLoaded && (
        <div className="overflow-hidden rounded-xl border border-hairline">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "260px" }}
            center={point ?? defaultMapCenter}
            zoom={point ? 16 : 11}
            onClick={pickFromMap}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {point && (
              <Marker position={point} draggable onDragEnd={pickFromMap} />
            )}
          </GoogleMap>
        </div>
      )}
      <p className="text-xs text-faint">
        Search above, or tap the map to drop a pin — drag it to fine-tune the
        exact spot.
      </p>
    </div>
  );
}
