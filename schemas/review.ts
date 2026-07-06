import { z } from "zod";

export const submitReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
  anonymous: z.boolean().default(false),
});

export const moderateReviewSchema = z.object({
  reviewId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});
