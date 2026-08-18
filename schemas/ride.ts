import { z } from "zod";

// "YYYY-MM-DDTHH:MM" from a datetime-local input, interpreted as Jamaica
// wall-clock by the action (lib/rides.ts parseRideTime).
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Invalid date/time");

export const requestRideSchema = z.object({
  pickupAddress: z.string().trim().min(5, "Enter the pickup address").max(400),
  pickupLat: z.string().max(30).optional(),
  pickupLng: z.string().max(30).optional(),
  dropoffAddress: z.string().trim().min(5, "Enter the destination").max(400),
  dropoffLat: z.string().max(30).optional(),
  dropoffLng: z.string().max(30).optional(),
  // Absent = as soon as possible.
  scheduledAt: localDateTime.optional(),
  // The rider's opening offer — free-form, at least $1.
  offerCents: z.coerce
    .number()
    .int()
    .min(100, "Offer at least $1.00")
    .max(10_000_000),
  // Route estimate from the maps widget, if it loaded.
  distanceM: z.coerce.number().int().min(0).max(1_000_000).optional(),
  // Optional link to the gig booking this ride serves.
  bookingId: z.string().uuid().optional(),
});

export const rideOfferSchema = z.object({
  rideId: z.string().uuid(),
  priceCents: z.coerce
    .number()
    .int()
    .min(100, "Offer at least $1.00")
    .max(10_000_000),
  note: z.string().trim().max(300).optional(),
});

export const acceptRideOfferSchema = z.object({
  rideId: z.string().uuid(),
  offerId: z.string().uuid(),
});

export const rideDecisionSchema = z.object({
  rideId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const rideReviewSchema = z.object({
  rideId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
});
