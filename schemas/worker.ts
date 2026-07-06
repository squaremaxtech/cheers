import { z } from "zod";
import { BODY_TYPES, JAMAICA_PARISHES, LANGUAGES } from "@/lib/constants";

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

function clearableEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.null(), z.enum(values)])
  );
}

export const workerProfileSchema = z.object({
  stageName: z
    .string()
    .trim()
    .min(2, "Stage name must be at least 2 characters")
    .max(40),
  realName: clearableString(120),
  bio: clearableString(2000),
  age: z.coerce.number().int().min(18, "Workers must be 18+").max(99),
  heightCm: clearableInt(120, 230),
  bodyType: clearableEnum(BODY_TYPES),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length).default([]),
  parish: z.enum(JAMAICA_PARISHES),
  city: clearableString(80),
  baseRateCents: z.coerce.number().int().min(0).max(10_000_000),
});

export const workerServiceSchema = z.object({
  serviceTypeId: z.string().uuid(),
  enabled: z.boolean(),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  durationMinutes: z.coerce.number().int().min(15).max(720),
  description: z.string().trim().max(500).optional(),
});

export const serviceAddonSchema = z.object({
  workerServiceId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  description: z.string().trim().max(300).optional(),
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
