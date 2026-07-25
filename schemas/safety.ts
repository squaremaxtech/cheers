import { z } from "zod";
import { MAX_TRUSTED_CONTACTS } from "@/lib/constants";

// Every string is length-capped: an uncapped text field on an endpoint that
// writes to the database is a free denial-of-service.

const pin = z.string().regex(/^\d{4}$/, "Enter the 4-digit PIN");
const bookingId = z.string().uuid();

export const startServiceSchema = z.object({
  bookingId,
  pin,
});

export const wellnessCheckSchema = z.object({
  bookingId,
  status: z.enum(["ok", "help"]),
  note: z.string().trim().max(300).optional(),
  // A "quiet" help request: the screen shows a normal OK while the desk is
  // paged. Never echoed back to the client.
  covert: z.boolean().optional(),
  method: z.enum(["in_app", "push_action"]).optional(),
});

export const raiseAlertSchema = z.object({
  bookingId,
  message: z.string().trim().max(500).optional(),
});

export const alertActionSchema = z.object({
  alertId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

export const startTravelSchema = z.object({
  bookingId,
  // Minutes until the worker expects to arrive. Bounded so a typo cannot park
  // a no-arrival deadline a week out.
  etaMinutes: z.coerce.number().int().min(5).max(240),
});

export const endSessionSchema = z.object({
  bookingId,
  reason: z.enum(["left_visit", "home_safe", "cancelled"]),
});

export const heartbeatSchema = z.object({
  bookingId,
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracyM: z.coerce.number().min(0).max(100_000).optional(),
  speedMps: z.coerce.number().min(0).max(1000).optional(),
  headingDeg: z.coerce.number().min(0).max(360).optional(),
  batteryPct: z.coerce.number().int().min(0).max(100).optional(),
  online: z.boolean().optional(),
});

export const checkinResponseSchema = z.object({
  bookingId,
  status: z.enum(["ok", "help"]),
  method: z.enum(["in_app", "push_action"]).default("in_app"),
  covert: z.boolean().optional(),
  note: z.string().trim().max(300).optional(),
});

export const sosCancelSchema = z.object({
  bookingId,
  // Present when the worker has set a personal cancel code; absent means they
  // used the hold-to-cancel fallback.
  cancelPin: pin.optional(),
});

// Push subscriptions arrive from the browser. The endpoint is additionally
// checked against an allowlist of real push hosts server-side (lib/safety/push)
// before the server ever sends a request to it.
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});

export const trustedContactSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    notifyOn: z
      .array(z.enum(["session_start", "overdue", "alert"]))
      .min(1)
      .max(3)
      .default(["alert"]),
  })
  // Email is how we verify them and how they receive the tracking link, so a
  // contact with neither channel is not a contact.
  .refine((v) => Boolean(v.email) || Boolean(v.phone), {
    message: "Add an email address or a phone number.",
  });

export const removeTrustedContactSchema = z.object({
  contactId: z.string().uuid(),
});

export const setCancelPinSchema = z.object({
  cancelPin: pin,
});

export const phoneSchema = z.object({
  // Kept permissive on shape (international formats vary) but strictly bounded.
  phone: z.string().trim().min(7).max(30),
});

export const verifyPhoneSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const blockCustomerSchema = z.object({
  bookingId,
  reason: z.string().trim().max(500).optional(),
});

export const postVisitFlagSchema = z.object({
  bookingId,
  feltUnsafe: z.boolean(),
  note: z.string().trim().max(1000).optional(),
});

export const assignDriverSchema = z.object({
  bookingId,
  driverUserId: z.string().uuid(),
});

export const monitorPingSchema = z.object({
  bookingId,
  message: z.string().trim().max(200).optional(),
});

export const shiftSchema = z.object({
  userId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const deleteShiftSchema = z.object({
  shiftId: z.string().uuid(),
});

export const revealPinSchema = z.object({
  bookingId,
});

export const MAX_CONTACTS = MAX_TRUSTED_CONTACTS;
