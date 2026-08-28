import { z } from "zod";

// Onboarding and the AcceptTermsBanner both post this: acceptance is only
// recorded when the box is actually ticked.
export const acceptTermsSchema = z.object({
  accepted: z.literal(true, {
    message: "Please accept the Terms, Privacy Policy and Guidelines",
  }),
});

// The /welcome wizard's final submit. Onboarding records a usable profile
// and legal acceptance — nothing else: the Verified ID step is optional and
// never gates it (plan §2.4).
export const completeOnboardingSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\-\d\s]{7,20}$/, "Enter a phone number we can reach you on"),
  acceptTerms: z.literal(true, {
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
