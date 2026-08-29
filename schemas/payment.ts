import { z } from "zod";

// How the CUSTOMER paid the PROFESSIONAL. Every one of these settles directly
// between the two of them — the platform never receives the money, it records
// what happened. `card` exists in the db enum for historical rows only and is
// deliberately not offerable here: there is no card rail for job money.
export const jobPaymentMethod = z.enum(["cash", "bank", "lynk", "other"]);

const tipCents = z.coerce.number().int().min(0).max(10_000_000).default(0);

// Free-text reference the professional (or customer) can attach: a transfer
// reference, "paid at the door", a Lynk confirmation number. Never a file —
// there is no proof-upload flow and no arbitration built on one.
const paymentNote = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.union([z.null(), z.string().trim().max(300)])
);

// The customer accepts the booking and agrees to pay the professional
// directly. No money moves through CheersJA at this point or any other.
export const confirmDirectPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  tipCents,
});

// The customer says they have paid. This is a claim, not the record — the
// professional's confirmation is what settles it.
export const markJobPaymentSentSchema = z.object({
  bookingId: z.string().uuid(),
  method: jobPaymentMethod,
  note: paymentNote,
});

// The professional confirms the money is in hand. The service amount is
// derived server-side from the booking; they supply only the method, the tip
// actually received and an optional reference.
export const recordJobPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: jobPaymentMethod,
  tipCents,
  note: paymentNote,
});

// Marking a recorded payment refunded. A RECORD, not a money movement: the
// platform never held this money, so nothing is sent anywhere.
export const refundSchema = z.object({
  paymentId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

// Admin resolves a stuck pending payment: mark it collected (succeeded) or
// void it (failed).
export const adminPaymentStatusSchema = z.object({
  paymentId: z.string().uuid(),
  to: z.enum(["succeeded", "failed"]),
  note: z.string().trim().max(500).optional(),
});

// --- Platform revenue -------------------------------------------------------

// Where the browser should come back to after storing a card.
export const cardSetupSchema = z.object({
  returnTo: z.enum(["membership", "welcome", "earnings"]),
});

// Admin actions on a professional's monthly commission statement.
export const feeInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
