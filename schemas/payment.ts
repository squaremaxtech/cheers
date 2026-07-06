import { z } from "zod";
import { mediaUrl } from "@/schemas/worker";

export const checkoutSchema = z.object({
  bookingId: z.string().uuid(),
  tipCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

// Customer commits to paying cash at the meeting.
export const chooseCashSchema = z.object({
  bookingId: z.string().uuid(),
  tipCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

// Worker confirms the cash was collected. The amount is derived server-side
// from the booking — workers only report the tip and upload proof.
export const cashCollectedSchema = z.object({
  bookingId: z.string().uuid(),
  tipCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  proofUrl: mediaUrl,
});

export const refundSchema = z.object({
  paymentId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
