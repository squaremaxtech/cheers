import type { JobMatchMode, JobOfferStatus, JobRequestStatus } from "@/types";

// Presentation helpers for job requests (customer side, worker board and
// admin) — tones and copy, so every surface describes a request the same
// way. Lives with the components, not lib/ (no db imports: client-safe).

export function jobStatusTone(
  status: JobRequestStatus
): "gold" | "neutral" | "success" | "danger" | "warn" {
  switch (status) {
    case "open":
      return "warn";
    case "matched":
      return "success";
    case "cancelled":
    case "expired":
      return "neutral";
    default:
      return "neutral";
  }
}

export const JOB_OFFER_STATUS_LABELS: Record<JobOfferStatus, string> = {
  open: "Offer sent",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

export function jobOfferTone(
  status: JobOfferStatus
): "gold" | "neutral" | "success" | "danger" | "warn" {
  switch (status) {
    case "open":
      return "gold";
    case "accepted":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

// Short mode copy for cards (the long hints live in lib/constants).
export const JOB_MODE_SHORT: Record<JobMatchMode, string> = {
  manual: "Customer picks",
  first_accept: "Instant — first to accept",
  lowest_price: "Best price at deadline",
};

// Render a stored instant as Jamaica wall-clock (UTC-5, no DST).
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

// "2026-08-21" → "Fri, Aug 21" without timezone drift (the date is a
// Jamaica calendar date, not an instant).
export function formatJobDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr${h === 1 ? "" : "s"}` : `${h}h ${m}m`;
}
