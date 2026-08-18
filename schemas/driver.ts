import { z } from "zod";
import { JAMAICA_PARISHES } from "@/lib/constants";

const clearableText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.null(), z.string().trim().max(max)])
  );

const clearableInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.union([z.null(), z.coerce.number().int().min(min).max(max)])
  );

// Public photos (face, vehicle) are uploads to this server.
const uploadedPhotoUrl = z
  .string()
  .max(2000)
  .refine((v) => v.startsWith("/api/media/"), "Upload a photo first");

export const driverProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(40),
  bio: clearableText(1000),
  facePhotoUrl: uploadedPhotoUrl,
  parish: z.enum(JAMAICA_PARISHES),
  city: clearableText(80),
  vehicleMake: z.string().trim().min(2, "Enter the vehicle make").max(40),
  vehicleModel: z.string().trim().min(1, "Enter the vehicle model").max(40),
  vehicleYear: clearableInt(1980, 2035),
  vehicleColor: z.string().trim().min(2, "Enter the vehicle colour").max(30),
  vehiclePlate: z
    .string()
    .trim()
    .min(2, "Enter the licence plate")
    .max(12)
    .transform((v) => v.toUpperCase()),
  vehiclePhotoUrl: uploadedPhotoUrl,
  perKmRateCents: z.coerce.number().int().min(0).max(1_000_000),
  minFareCents: z.coerce.number().int().min(0).max(1_000_000),
});

// Identity documents live on this server only, under the uploader's own id —
// same policy as customer verification (schemas/verification.ts).
const identityDocUrl = z
  .string()
  .max(2000)
  .regex(
    /^\/api\/media\/identity\/[a-f0-9-]{36}\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/,
    "Upload a photo of the document first"
  );

export const driverVerificationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your name exactly as it appears on the document")
    .max(120),
  documentType: z.enum(["drivers_license", "passport", "national_id"]),
  documentUrl: identityDocUrl,
  licenseUrl: identityDocUrl,
});

export const reviewDriverVerificationSchema = z.object({
  verificationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});
