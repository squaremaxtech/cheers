"use client";

import { useEffect, useRef } from "react";

type PlaceResult = {
  formatted_address?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

type Autocomplete = {
  addListener: (event: string, cb: () => void) => void;
  getPlace: () => PlaceResult;
};

type MapsGlobal = {
  maps?: {
    places?: {
      Autocomplete: new (
        el: HTMLInputElement,
        opts: { componentRestrictions: { country: string } }
      ) => Autocomplete;
    };
  };
};

declare global {
  interface Window {
    google?: MapsGlobal;
  }
}

// Google Places autocomplete when an API key is configured; a plain input
// otherwise. Coordinates are captured silently when Google resolves a place.
export default function AddressInput({
  apiKey,
  onChange,
}: {
  apiKey: string;
  onChange: (address: string, lat?: string, lng?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    function attach() {
      const AutocompleteCtor = window.google?.maps?.places?.Autocomplete;
      if (!AutocompleteCtor || !inputRef.current) return;
      const autocomplete = new AutocompleteCtor(inputRef.current, {
        componentRestrictions: { country: "jm" },
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place.geometry?.location;
        onChange(
          place.formatted_address ?? inputRef.current?.value ?? "",
          location ? String(location.lat()) : undefined,
          location ? String(location.lng()) : undefined
        );
      });
    }

    if (window.google?.maps?.places) {
      attach();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-cheers-maps]"
    );
    if (existing) {
      existing.addEventListener("load", attach);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.dataset.cheersMaps = "1";
    script.addEventListener("load", attach);
    document.head.appendChild(script);
  }, [apiKey, onChange]);

  return (
    <input
      ref={inputRef}
      className="input"
      placeholder="Street address, area, parish…"
      required
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
