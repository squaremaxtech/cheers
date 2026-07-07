import type { Libraries } from "@react-google-maps/api";

export const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Single stable reference so useJsApiLoader isn't re-initialised per component.
export const mapsLibraries: Libraries = ["places"];

// Fallback center (Kingston, Jamaica) until we have a real point.
export const defaultMapCenter = { lat: 18.0179, lng: -76.8099 };

export type LatLng = { lat: number; lng: number };

export function hasMapsKey(): boolean {
  return mapsApiKey.trim().length > 0;
}

// Booking coordinates are stored as text columns — parse defensively.
export function parseLatLng(
  lat: string | null | undefined,
  lng: string | null | undefined
): LatLng | null {
  if (!lat || !lng) return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  return point;
}

// Straight-line distance in metres (haversine).
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}
