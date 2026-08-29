import { z } from "zod";
import {
  CHECKIN_INTERVAL_OPTIONS,
  GIG_DESCRIPTION_MAX_CHARS,
  GIG_TAGS_MAX,
  GIG_TITLE_MAX_CHARS,
  QUOTE_DESCRIPTION_MAX_CHARS,
} from "@/lib/constants";
import { gigPaymentMethodIds } from "@/schemas/payment-method";

const clearableText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.null(), z.string().trim().max(max)])
  );

// One tag SLUG from the gig_tags vocabulary. The worker picks from a list —
// this shape only rules out anything that could not be a slug at all; whether
// the slug actually exists and is still active is settled against the table
// in lib/tags.ts validTagSlugs (unknown slugs are dropped, not rejected).
const tagSlug = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Pick tags from the list");

// How often the worker is prompted to check in DURING a job of this gig.
// null = the platform default; 0 = start and end only. Anything not offered by
// CHECKIN_INTERVAL_OPTIONS is refused, so the cadence can never be dialled out
// to a number nobody chose. This is only the periodic prompt: SOS, the duress
// PIN, PIN-verified start and get-home-safe never depend on it.
const checkinIntervalMinutes = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.union([
    z.null(),
    z.coerce
      .number()
      .int()
      .refine(
        (m) => CHECKIN_INTERVAL_OPTIONS.some((o) => o.minutes === m),
        "Pick a check-in cadence from the list"
      ),
  ])
);

export const gigSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give your gig a title")
    .max(GIG_TITLE_MAX_CHARS),
  categoryId: z.string().uuid(),
  tags: z.array(tagSlug).max(GIG_TAGS_MAX).default([]),
  description: clearableText(GIG_DESCRIPTION_MAX_CHARS),
  pricingMode: z.enum(["fixed", "quote"]),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  durationMinutes: z.coerce.number().int().min(15).max(720),
  safetyMonitored: z.boolean().default(true),
  checkinIntervalMinutes: checkinIntervalMinutes.default(null),
  // Premium services are visible only to premium members. actions/gigs.ts
  // forces this back to false unless the worker is a premium provider — the
  // UI toggle is a convenience, the server rule is the boundary.
  premium: z.boolean().default(false),
  active: z.boolean().default(true),
  // Which of the worker's payment methods this gig accepts.
  //
  // Deliberately NO default — the same absence rule the cadence field relies
  // on. ABSENT means "leave this gig's allowlist exactly as it is", so a
  // partial save from a screen that never rendered the control (a worker with
  // fewer than two methods) cannot wipe a restriction they set earlier. An
  // EMPTY ARRAY is an explicit "no restriction", which is the default state:
  // every active method. See lib/payment-methods.ts.
  paymentMethodIds: gigPaymentMethodIds.optional(),
});

export const updateGigSchema = gigSchema.partial().extend({
  gigId: z.string().uuid(),
});

export const gigAddonSchema = z.object({
  gigId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  description: z.string().trim().max(300).optional(),
});

// --- Quotes (quote-mode gigs) --------------------------------------------------

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour format");

export const quoteRequestSchema = z.object({
  gigId: z.string().uuid(),
  description: z
    .string()
    .trim()
    .min(10, "Describe the job so the worker can price it")
    .max(QUOTE_DESCRIPTION_MAX_CHARS),
  preferredDate: dateString.optional(),
  preferredTime: timeString.optional(),
  locationNote: z.string().trim().max(200).optional(),
});

export const quoteOfferSchema = z.object({
  quoteId: z.string().uuid(),
  priceCents: z.coerce
    .number()
    .int()
    .min(100, "Offer at least $1.00")
    .max(10_000_000),
  durationMinutes: z.coerce.number().int().min(15).max(720),
  note: z.string().trim().max(500).optional(),
});

// Accepting turns the offer into a real booking, so it needs the where/when
// every booking needs.
export const quoteAcceptSchema = z.object({
  quoteId: z.string().uuid(),
  date: dateString,
  startTime: timeString,
  address: z.string().trim().min(5, "Enter the full address").max(400),
  lat: z.string().max(30).optional(),
  lng: z.string().max(30).optional(),
  instructions: z.string().trim().max(1000).optional(),
});

export const quoteDecisionSchema = z.object({
  quoteId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
