import { z } from "zod";
import {
  JAMAICA_PARISHES,
  LANGUAGES,
  WORKER_HEADLINE_MAX_CHARS,
  WORKER_SKILLS_MAX,
  WORKER_SKILL_MAX_CHARS,
  WORKER_YEARS_EXPERIENCE_MAX,
} from "@/lib/constants";

// Optional-and-clearable fields: "" / null / undefined all mean "clear to null",
// so the profile editor can remove previously saved values.
function clearableString(max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.null(), z.string().trim().max(max)])
  );
}

function clearableInt(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.null(), z.coerce.number().int().min(min).max(max)])
  );
}

// Skills arrive from the form as one comma-separated string; the profile
// form and the admin editor both post that shape. Empty entries are dropped.
const skills = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : v,
  z
    .array(z.string().trim().min(1).max(WORKER_SKILL_MAX_CHARS))
    .max(WORKER_SKILLS_MAX, `At most ${WORKER_SKILLS_MAX} skills`)
    .default([])
);

export const workerProfileSchema = z.object({
  // Public display name. The legal name (realName) stays private and is only
  // used for ID review.
  stageName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(40),
  realName: clearableString(120),
  bio: clearableString(2000),
  headline: clearableString(WORKER_HEADLINE_MAX_CHARS),
  skills,
  yearsExperience: clearableInt(0, WORKER_YEARS_EXPERIENCE_MAX),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length).default([]),
  parish: z.enum(JAMAICA_PARISHES),
  city: clearableString(80),
  baseRateCents: z.coerce.number().int().min(0).max(10_000_000),
});

// Creating a profile also records legal acceptance — the checkbox is
// required, so it is part of the create schema rather than the shared one.
export const createWorkerProfileSchema = workerProfileSchema.extend({
  acceptTerms: z.literal(true, {
    message:
      "Please accept the Terms of Service and the Independent Professional Agreement",
  }),
});

// Accepts absolute http(s) URLs or files uploaded to this server (/api/media/…).
export const mediaUrl = z
  .string()
  .max(2000)
  .refine(
    (v) => v.startsWith("/api/media/") || /^https?:\/\/\S+$/.test(v),
    "Must be an uploaded file or a valid URL"
  );

export const mediaSchema = z.object({
  type: z.enum(["photo", "video"]),
  url: mediaUrl,
  // Optional gig tag; untagged media shows on every gig and the profile.
  gigId: z.string().uuid().nullish(),
});

export const mediaGigSchema = z.object({
  mediaId: z.string().uuid(),
  gigId: z.union([z.null(), z.string().uuid()]),
});

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour format");

export const availabilitySlotSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
  })
  .refine((s) => s.startTime < s.endTime, {
    message: "End time must be after start time",
  });

export const weeklyAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(28),
});

export const availabilityExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  available: z.boolean().default(false),
  note: z.string().trim().max(200).optional(),
});
