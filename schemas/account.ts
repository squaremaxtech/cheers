import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\-\d\s]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
});
