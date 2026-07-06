import type { BookingStatus } from "@/types";

// Booking status → badge tone, shared by every list/detail view.
export function statusTone(
  status: BookingStatus
): "gold" | "neutral" | "success" | "danger" | "warn" {
  switch (status) {
    case "confirmed":
    case "completed":
      return "success";
    case "declined":
    case "cancelled":
    case "refunded":
      return "danger";
    case "accepted":
      return "gold";
    case "in_progress":
      return "warn";
    default:
      return "neutral";
  }
}
