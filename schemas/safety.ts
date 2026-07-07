import { z } from "zod";

export const startServiceSchema = z.object({
  bookingId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, "Enter the 4-digit PIN"),
});

export const wellnessCheckSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(["ok", "help"]),
  note: z.string().trim().max(300).optional(),
});

export const raiseAlertSchema = z.object({
  bookingId: z.string().uuid(),
  message: z.string().trim().max(500).optional(),
});

export const alertActionSchema = z.object({
  alertId: z.string().uuid(),
});
