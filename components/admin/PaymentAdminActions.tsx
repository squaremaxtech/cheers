"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { markPayoutPaid } from "@/actions/admin";
import { refundPayment } from "@/actions/payments";
import type { PaymentRow } from "@/types";

// Renders refund (for a payment) or mark-paid (for a payout) controls.
export default function PaymentAdminActions({
  paymentId,
  status,
  payoutId,
}: {
  paymentId?: string;
  status?: PaymentRow["status"];
  payoutId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (payoutId) {
    return (
      <button
        type="button"
        disabled={busy}
        className="btn-gold px-3 py-1.5 text-xs"
        onClick={async () => {
          if (!window.confirm("Mark this payout as paid?")) return;
          setBusy(true);
          const res = await markPayoutPaid({ payoutId });
          setBusy(false);
          if (res.ok) {
            toast.success("Payout marked paid");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        }}
      >
        {busy ? "…" : "Mark paid"}
      </button>
    );
  }

  if (!paymentId || status !== "succeeded") return null;

  return (
    <button
      type="button"
      disabled={busy}
      className="btn-danger px-3 py-1.5 text-xs"
      onClick={async () => {
        if (!window.confirm("Refund this payment? Card refunds go through Stripe.")) return;
        setBusy(true);
        const res = await refundPayment({ paymentId });
        setBusy(false);
        if (res.ok) {
          toast.success("Refund issued");
          router.refresh();
        } else {
          toast.error(res.error);
        }
      }}
    >
      {busy ? "…" : "Refund"}
    </button>
  );
}
