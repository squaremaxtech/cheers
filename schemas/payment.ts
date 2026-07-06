import { z } from "zod";

export const checkoutSchema = z.object({
  bookingId: z.string().uuid(),
  tipCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

export const cashPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amountCents: z.coerce.number().int().min(0).max(100_000_000),
  tipCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  proofUrl: z.string().url().max(2000),
});

export const refundSchema = z.object({
  paymentId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
