// Money-in configuration.
//
// CheersJA collects exactly two things by card: the customer's monthly
// membership, and the professional's 5% commission billed monthly in arrears.
// It never collects the price of a job — that is paid customer → professional
// directly (cash, bank transfer, Lynk) and the app only records it. There is
// no payout path anywhere in this codebase.
//
// These constants live here rather than in lib/constants.ts so the billing
// rails can be tuned without touching the shared constants module.

// --- Commission invoices ---------------------------------------------------

// How long after a period closes before the card is charged. Gives a
// professional a moment to see the statement before money moves.
export const FEE_INVOICE_DUE_DAYS = Number(
  process.env.FEE_INVOICE_DUE_DAYS ?? 3
);

// Failed charges are retried on this cadence, this many times, and then left
// alone for a human. A card that declines four times is not going to work on
// the fifth try; it needs a conversation.
export const FEE_INVOICE_RETRY_DAYS = Number(
  process.env.FEE_INVOICE_RETRY_DAYS ?? 1
);
export const FEE_INVOICE_MAX_ATTEMPTS = Number(
  process.env.FEE_INVOICE_MAX_ATTEMPTS ?? 3
);

// Enforcement. A professional whose commission has failed for this long, over
// at least this many attempts, has their listings paused until it clears.
// Both thresholds must be crossed: nobody loses their livelihood over one
// declined card on a Tuesday.
export const FEE_GRACE_DAYS = Number(process.env.FEE_GRACE_DAYS ?? 7);
export const FEE_BLOCK_MIN_ATTEMPTS = 2;

// --- Membership ------------------------------------------------------------

// Renewal is OUR job (PowerTranz is a card gateway, not a billing engine):
// runBilling() charges memberships whose period ends inside this window.
export const MEMBERSHIP_RENEW_WINDOW_HOURS = Number(
  process.env.MEMBERSHIP_RENEW_WINDOW_HOURS ?? 24
);

// A failed renewal is retried once a day; three consecutive failures cancel.
export const MEMBERSHIP_RETRY_HOURS = Number(
  process.env.MEMBERSHIP_RETRY_HOURS ?? 24
);
export const MEMBERSHIP_MAX_FAILURES = 3;

// --- How the customer pays the professional --------------------------------

// The methods a job payment can be recorded under. `card` exists in the db
// enum for historical rows only and is deliberately absent here: the platform
// has no card rail for job money and never will.
export const JOB_PAYMENT_METHODS = [
  {
    value: "cash",
    label: "Cash",
    hint: "Handed over in person at the job.",
  },
  {
    value: "bank",
    label: "Bank transfer",
    hint: "NCB, Scotiabank, JN — sent to the account they gave you.",
  },
  { value: "lynk", label: "Lynk", hint: "Sent to their Lynk number." },
  { value: "other", label: "Other", hint: "Anything else you agreed." },
] as const;

export type JobPaymentMethod = (typeof JOB_PAYMENT_METHODS)[number]["value"];


// Narrow an arbitrary string (a <select> value, a stored row) to a method we
// actually offer. Anything unrecognised — including the historical "card" —
// falls back to cash rather than being asserted into the type.
export function toJobPaymentMethod(value: unknown): JobPaymentMethod {
  const found = JOB_PAYMENT_METHODS.find((m) => m.value === value);
  return found ? found.value : "cash";
}

export function jobPaymentMethodLabel(method: string): string {
  return (
    JOB_PAYMENT_METHODS.find((m) => m.value === method)?.label ??
    (method === "card" ? "Card (legacy)" : method)
  );
}

// The one sentence that must appear wherever job money is discussed. Kept in
// one place so no surface can drift into implying the platform holds it.
export const DIRECT_PAYMENT_NOTICE =
  "CheersJA never holds your money. The job is paid directly to your professional — we only record that it happened.";

export const WORKER_DIRECT_PAYMENT_NOTICE =
  "CheersJA never holds your money. Customers pay you directly and you keep every cent of it. The only thing we ever charge your card is the 5% commission on completed jobs, billed once a month.";
