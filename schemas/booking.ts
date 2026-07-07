import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour format");

export const createBookingSchema = z.object({
  workerId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  date: dateString,
  startTime: timeString,
  // Range check only — the action allows the standard durations plus the
  // worker's own duration for the service, which isn't knowable here.
  durationMinutes: z.coerce.number().int().min(15).max(720),
  address: z.string().trim().min(5, "Enter the full address").max(400),
  lat: z.string().max(30).optional(),
  lng: z.string().max(30).optional(),
  instructions: z.string().trim().max(1000).optional(),
  addonIds: z.array(z.string().uuid()).max(20).default([]),
});

export const bookingSlotsSchema = z.object({
  workerId: z.string().uuid(),
  date: dateString,
  durationMinutes: z.coerce.number().int().min(15).max(720),
  // Reschedules ignore the booking being moved when computing conflicts.
  excludeBookingId: z.string().uuid().optional(),
});

export const bookingDatesSchema = z.object({
  workerId: z.string().uuid(),
  // First day of the month being viewed in the booking calendar.
  month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month"),
  durationMinutes: z.coerce.number().int().min(15).max(720),
  excludeBookingId: z.string().uuid().optional(),
});

export const bookingDecisionSchema = z.object({
  bookingId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleBookingSchema = z.object({
  bookingId: z.string().uuid(),
  date: dateString,
  startTime: timeString,
});

export const reassignBookingSchema = z.object({
  bookingId: z.string().uuid(),
  newWorkerId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
