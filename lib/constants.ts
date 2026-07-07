// Customers may cancel up to this many hours before the booking start time.
export const CANCEL_MIN_HOURS = 5;

// Percent of the booking price (excluding tip) kept by the platform.
export const PLATFORM_FEE_PERCENT = Number(
  process.env.PLATFORM_FEE_PERCENT ?? 5
);

export const CURRENCY = "usd"; // Stripe currency; amounts stored as integer cents

// All booking dates/times are Jamaica wall-clock time (UTC-5, no DST).
// Parsing must pin this offset — server timezone must never matter.
export const JAMAICA_UTC_OFFSET = "-05:00";

export const JAMAICA_PARISHES = [
  "Kingston",
  "St. Andrew",
  "St. Thomas",
  "Portland",
  "St. Mary",
  "St. Ann",
  "Trelawny",
  "St. James",
  "Hanover",
  "Westmoreland",
  "St. Elizabeth",
  "Manchester",
  "Clarendon",
  "St. Catherine",
] as const;

export const BODY_TYPES = [
  "Slim",
  "Athletic",
  "Average",
  "Curvy",
  "Muscular",
  "Plus size",
] as const;

export const LANGUAGES = [
  "English",
  "Patois",
  "Spanish",
  "French",
  "German",
] as const;

export const BOOKING_DURATIONS_MINUTES = [60, 90, 120, 180, 240, 360] as const;

// While a booking is in progress the worker checks in on this cadence; the
// booking room flags the check as overdue past it.
export const WELLNESS_CHECK_INTERVAL_MINUTES = 30;

// Chat rules: each text message is capped, and each room keeps at most
// CHAT_ROOM_MESSAGE_CAP messages. Pruning runs in batches — once a room
// overflows by CHAT_PRUNE_BATCH, the oldest overflow is deleted — so new
// messages replace old ones ~10 at a time instead of on every send.
export const CHAT_MESSAGE_MAX_CHARS = 1000;
export const CHAT_ROOM_MESSAGE_CAP = 1000;
export const CHAT_PRUNE_BATCH = 10;

// ID documents accepted for customer identity verification.
export const ID_DOCUMENT_TYPES = [
  { value: "drivers_license", label: "Driver's licence" },
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID card" },
] as const;

export function idDocumentLabel(value: string): string {
  return ID_DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

// Today's date in Jamaica (UTC-5, no DST). new Date().toISOString() is UTC,
// which runs a day ahead of Jamaica every evening — never use it for "today".
export function jamaicaTodayISO(): string {
  return new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function platformFeeCents(priceCents: number): number {
  return Math.round((priceCents * PLATFORM_FEE_PERCENT) / 100);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatStars(avgRatingX100: number): string {
  return (avgRatingX100 / 100).toFixed(1);
}

// "18:30" (or "18:30:00") → "6:30 PM". Customers think in 12-hour time.
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
