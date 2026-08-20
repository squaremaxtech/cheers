import { z } from "zod";
import {
  JAMAICA_PARISHES,
  JOB_BUDGET_MIN_CENTS,
  JOB_DESCRIPTION_MAX_CHARS,
  JOB_TAGS_MAX,
  JOB_TITLE_MAX_CHARS,
} from "@/lib/constants";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour format");
// "YYYY-MM-DDTHH:MM" from a datetime-local input, read as Jamaica wall-clock
// by the action (lib/jobs.ts parseJobLocalTime).
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Invalid date/time");

const tag = z
  .string()
  .trim()
  .min(2, "Tags need at least 2 characters")
  .max(30)
  .regex(/^[^,]+$/, "Tags cannot contain commas");

const money = z.coerce
  .number()
  .int()
  .min(JOB_BUDGET_MIN_CENTS, "Enter at least $1.00")
  .max(10_000_000);

// Posting a request: what, which category, where (parish public, address
// private), when, for how long, the customer's budget and the matching rule.
export const postJobRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, "Give your request a short title")
      .max(JOB_TITLE_MAX_CHARS),
    categoryId: z.string().uuid("Pick a category"),
    description: z
      .string()
      .trim()
      .min(20, "Describe the job so workers can price it (20+ characters)")
      .max(JOB_DESCRIPTION_MAX_CHARS),
    tags: z.array(tag).max(JOB_TAGS_MAX).default([]),
    parish: z.enum(JAMAICA_PARISHES, { message: "Pick a parish" }),
    area: z.string().trim().max(80).optional(),
    address: z.string().trim().min(5, "Enter the full address").max(400),
    lat: z.string().max(30).optional(),
    lng: z.string().max(30).optional(),
    date: dateString,
    startTime: timeString,
    durationMinutes: z.coerce.number().int().min(15).max(720),
    budgetCents: money,
    matchMode: z.enum(["manual", "first_accept", "lowest_price"]),
    // Required for lowest_price (validated below), ignored otherwise.
    autoBookAt: localDateTime.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.matchMode === "lowest_price" && !v.autoBookAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["autoBookAt"],
        message: "Choose when the best offer should be booked automatically",
      });
    }
  });

// A worker's offer: the budget as-is ("accept") or a counter price, fulfilled
// with one of their live gigs in the request's category. gigId may be omitted
// when the worker has exactly one eligible gig (the action resolves it).
export const jobOfferSchema = z.object({
  jobRequestId: z.string().uuid(),
  gigId: z.string().uuid().optional(),
  priceCents: money,
  durationMinutes: z.coerce.number().int().min(15).max(720).optional(),
  note: z.string().trim().max(500).optional(),
});

export const jobRequestDecisionSchema = z.object({
  jobRequestId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const jobOfferDecisionSchema = z.object({
  jobRequestId: z.string().uuid(),
  offerId: z.string().uuid(),
});
