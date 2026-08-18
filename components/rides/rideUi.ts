import type { RideStatus } from "@/types";

// Ride status → badge tone, shared by every ride list/room view. Lives with
// the ride components (not lib/status.ts) — it is presentation, not domain.
export function rideStatusTone(
  status: RideStatus
): "gold" | "neutral" | "success" | "danger" | "warn" {
  switch (status) {
    case "accepted":
      return "gold";
    case "arriving":
    case "picked_up":
      return "warn";
    case "completed":
      return "success";
    case "cancelled":
    case "expired":
      return "danger";
    default:
      return "neutral"; // requested
  }
}

// Render a stored Date as Jamaica wall-clock (UTC-5, no DST) — the server's
// own timezone must never leak into what riders and drivers read.
export function formatJamaicaDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    timeZone: "America/Jamaica",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
