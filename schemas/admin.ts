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

// note = admin's own reference for who the invite is meant for.
export const workerInviteSchema = z.object({
  note: z.string().trim().max(200).optional(),
});
