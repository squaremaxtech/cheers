import { z } from "zod";
import { workerProfileSchema } from "@/schemas/worker";

// Admin can edit any worker field plus platform-only flags. There is no
// approval flag: professionals publish themselves (plan §2.1). Hide/suspend
// remain the moderation levers.
export const adminUpdateWorkerSchema = z.object({
  workerId: z.string().uuid(),
  profile: workerProfileSchema.partial(),
  active: z.boolean().optional(),
  suspended: z.boolean().optional(),
});

// The premium tier is admin-curated: grant/revoke customer access and
// worker provider status from /admin/promote. Both are audited.
export const setCustomerPremiumAccessSchema = z.object({
  userId: z.string().uuid(),
  enabled: z.boolean(),
});

export const setWorkerPremiumProviderSchema = z.object({
  workerId: z.string().uuid(),
  enabled: z.boolean(),
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
