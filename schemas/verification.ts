import { z } from "zod";

// Identity documents only ever live on this server (never external URLs) —
// the media route gates who may view them. The owning-user check happens in
// the action, where the caller's id is known.
const identityDocUrl = z
  .string()
  .max(2000)
  .regex(
    /^\/api\/media\/identity\/[a-f0-9-]{36}\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/,
    "Upload a photo of your document first"
  );

export const submitVerificationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your name exactly as it appears on the document")
    .max(120),
  documentType: z.enum(["drivers_license", "passport", "national_id"]),
  documentUrl: identityDocUrl,
});

export const reviewVerificationSchema = z.object({
  verificationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});
