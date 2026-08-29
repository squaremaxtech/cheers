import { z } from "zod";
import { jobPaymentMethod } from "@/schemas/payment";

// The shapes for a professional's OWN ways of being paid (worker_payment_methods).
//
// This module is deliberately free of any database import so the worker
// editor, the gig editor and the customer's pay panel — all client
// components — can share one vocabulary. The rules that need the database
// (ownership, the "no rows = all methods" default, and the refusal to strand
// a gig) live in lib/payment-methods.ts.

// A method's KIND is the same four values as the db enum worker_payment_kind
// and — on purpose — the same set as jobPaymentMethod in schemas/payment.ts.
// A customer records a payment under the KIND of the method they used, so if
// these two vocabularies ever drifted apart, payments.method could not
// describe the method the customer was actually shown.
export const workerPaymentKindSchema = jobPaymentMethod;

export type WorkerPaymentKindValue = z.infer<typeof workerPaymentKindSchema>;

// Enough for several accounts without turning a payment screen into a menu.
// Eight is already more ways to be paid than anyone has.
export const WORKER_PAYMENT_METHODS_MAX = 8;

// What the PROFESSIONAL calls it ("NCB — main account"). Long enough to tell
// two accounts apart, short enough to sit on one line of a customer's screen.
export const PAYMENT_METHOD_LABEL_MIN = 2;
export const PAYMENT_METHOD_LABEL_MAX = 60;

// What the CUSTOMER needs in order to pay: an account number, a Lynk number,
// "cash on the night". A payment instruction, not a contract.
export const PAYMENT_METHOD_DETAILS_MAX = 200;

// A glyph per kind. It lives here rather than in a component because both the
// worker's editor and the customer's pay panel render the same four kinds and
// they must never disagree about which is which.
export const PAYMENT_KIND_ICONS: Record<WorkerPaymentKindValue, string> = {
  cash: "💵",
  bank: "🏦",
  lynk: "📱",
  other: "•",
};

const label = z
  .string()
  .trim()
  .min(PAYMENT_METHOD_LABEL_MIN, "Give this a name you'll recognise")
  .max(PAYMENT_METHOD_LABEL_MAX);

// Clearable: "" / null / undefined all mean "no details" — a cash method
// genuinely has none.
const details = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.union([z.null(), z.string().trim().max(PAYMENT_METHOD_DETAILS_MAX)])
);

export const addPaymentMethodSchema = z.object({
  kind: workerPaymentKindSchema,
  label,
  details,
});

export const updatePaymentMethodSchema = z.object({
  methodId: z.string().uuid(),
  kind: workerPaymentKindSchema,
  label,
  details,
});

export const setPaymentMethodActiveSchema = z.object({
  methodId: z.string().uuid(),
  active: z.boolean(),
});

export const paymentMethodIdSchema = z.object({
  methodId: z.string().uuid(),
});

// The full ordered list of the worker's method ids. Sending the whole order
// rather than a "move up" delta means the server never has to guess what the
// screen looked like.
export const reorderPaymentMethodsSchema = z.object({
  methodIds: z
    .array(z.string().uuid())
    .max(WORKER_PAYMENT_METHODS_MAX),
});

// The per-gig allowlist, as it arrives on schemas/gig.ts.
//
// ABSENT means "don't touch this gig's allowlist" (a partial save from a
// screen that never showed the control). An EMPTY ARRAY means "clear it" —
// which restores the default, every active method.
export const gigPaymentMethodIds = z
  .array(z.string().uuid())
  .max(WORKER_PAYMENT_METHODS_MAX);
