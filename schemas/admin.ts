import { z } from "zod";
import { workerProfileSchema } from "@/schemas/worker";

// Admin can edit any worker field plus platform-only flags.
export const adminUpdateWorkerSchema = z.object({
  workerId: z.string().uuid(),
  profile: workerProfileSchema.partial(),
  verified: z.boolean().optional(),
  active: z.boolean().optional(),
  suspended: z.boolean().optional(),
});

export const adminSuspendUserSchema = z.object({
  userId: z.string().uuid(),
  suspended: z.boolean(),
});

export const markPayoutPaidSchema = z.object({
  payoutId: z.string().uuid(),
  note: z.string().trim().max(300).optional(),
});

// Admin can edit platform flags on any driver (approval, availability,
// suspension). Profile fields stay the driver's own.
export const adminUpdateDriverSchema = z.object({
  driverId: z.string().uuid(),
  verified: z.boolean().optional(),
  active: z.boolean().optional(),
  suspended: z.boolean().optional(),
});

// Gig takedown / restore.
export const adminGigSuspendSchema = z.object({
  gigId: z.string().uuid(),
  suspended: z.boolean(),
  note: z.string().trim().max(300).optional(),
});

// Browse taxonomy management.
export const gigCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  blurb: z.string().trim().max(140).optional(),
});

export const updateGigCategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(60).optional(),
  blurb: z.string().trim().max(140).optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});
