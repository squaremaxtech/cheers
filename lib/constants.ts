// Customers may cancel up to this many hours before the booking start time.
export const CANCEL_MIN_HOURS = 5;

// Percent of the booking price (excluding tip) kept by the platform.
export const PLATFORM_FEE_PERCENT = Number(
  process.env.PLATFORM_FEE_PERCENT ?? 5
);

export const CURRENCY = "usd"; // Stripe currency; amounts stored as integer cents

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
