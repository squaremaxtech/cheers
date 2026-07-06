import { z } from "zod";
import { BODY_TYPES, JAMAICA_PARISHES, LANGUAGES } from "@/lib/constants";

export const workerProfileSchema = z.object({
  stageName: z
    .string()
    .trim()
    .min(2, "Stage name must be at least 2 characters")
    .max(40),
  realName: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  age: z.coerce.number().int().min(18, "Workers must be 18+").max(99),
  heightCm: z.coerce.number().int().min(120).max(230).optional(),
  bodyType: z.enum(BODY_TYPES).optional(),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length).default([]),
  parish: z.enum(JAMAICA_PARISHES),
  city: z.string().trim().max(80).optional(),
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

export const mediaSchema = z.object({
  type: z.enum(["photo", "video"]),
  url: z.string().url().max(2000),
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
