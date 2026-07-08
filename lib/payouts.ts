import type { BookingRow, PaymentRow } from "@/types";

// Net-settlement ledger for weekly payouts. Policy: workers KEEP the cash
// they collect at meetings.
//   card bookings — the platform holds the money, so the worker is credited
//     the service total minus the platform fee, plus card tips in full.
//   cash bookings — the worker already holds everything (tips included), so
//     their balance is debited the platform fee instead.
// A worker's weekly payout is the sum across their bookings; a NEGATIVE
// total means the worker owes the platform for a cash-heavy week (settled by
// remittance or deducted from a future payout).
//
// Used by BOTH generateWeeklyPayouts and the admin "Awaiting payout" panel —
// keep them on this one function so the preview always matches generation.
export function payoutContribution(
  booking: Pick<BookingRow, "priceCents" | "addonsCents" | "platformFeeCents">,
  succeededPayments: Pick<PaymentRow, "method" | "tipCents">[]
): { amountCents: number; tipsCents: number } {
  const hasCard = succeededPayments.some((p) => p.method === "card");
  if (!hasCard) {
    return { amountCents: -booking.platformFeeCents, tipsCents: 0 };
  }
  const cardTips = succeededPayments
    .filter((p) => p.method === "card")
    .reduce((sum, p) => sum + p.tipCents, 0);
  return {
    amountCents:
      booking.priceCents + booking.addonsCents - booking.platformFeeCents,
    tipsCents: cardTips,
  };
}
