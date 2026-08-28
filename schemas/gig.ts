import { z } from "zod";
import {
  GIG_DESCRIPTION_MAX_CHARS,
  GIG_TAGS_MAX,
  GIG_TITLE_MAX_CHARS,
  QUOTE_DESCRIPTION_MAX_CHARS,
} from "@/lib/constants";

const clearableText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.null(), z.string().trim().max(max)])
  );

// One tag: short, human, no commas (the editor splits on commas).
const tag = z
  .string()
  .trim()
  .min(2, "Tags need at least 2 characters")
  .max(30)
  .regex(/^[^,]+$/, "Tags cannot contain commas");

export const gigSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give your gig a title")
    .max(GIG_TITLE_MAX_CHARS),
  categoryId: z.string().uuid(),
  tags: z.array(tag).max(GIG_TAGS_MAX).default([]),
  description: clearableText(GIG_DESCRIPTION_MAX_CHARS),
  pricingMode: z.enum(["fixed", "quote"]),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  durationMinutes: z.coerce.number().int().min(15).max(720),
  safetyMonitored: z.boolean().default(true),
  // Premium services are visible only to premium members. actions/gigs.ts
  // forces this back to false unless the worker is a premium provider — the
  // UI toggle is a convenience, the server rule is the boundary.
  premium: z.boolean().default(false),
  active: z.boolean().default(true),
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
