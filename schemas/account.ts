import { z } from "zod";

// Onboarding and the AcceptTermsBanner both post this: acceptance is only
// recorded when the box is actually ticked.
export const acceptTermsSchema = z.object({
  accepted: z.literal(true, {
    message: "Please accept the Terms, Privacy Policy and Guidelines",
  }),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\-\d\s]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
});
