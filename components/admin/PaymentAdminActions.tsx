"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { markPayoutPaid } from "@/actions/admin";
import { adminResolvePendingPayment, refundPayment } from "@/actions/payments";
import type { ActionResult, PaymentRow } from "@/types";

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

  if (!paymentId) return null;

  async function act(
    confirmText: string,
    fn: () => Promise<ActionResult<undefined>>,
    success: string
  ) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (status === "pending") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          className="btn-gold px-3 py-1.5 text-xs"
          onClick={() =>
            act(
              "Mark this payment as collected? The booking confirms if it was still awaiting payment.",
              () =>
                adminResolvePendingPayment({ paymentId, to: "succeeded" }),
              "Payment marked collected"
            )
          }
        >
          {busy ? "…" : "Mark collected"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-danger px-3 py-1.5 text-xs"
          onClick={() =>
            act(
              "Void this pending payment? Use when it will never be collected.",
              () => adminResolvePendingPayment({ paymentId, to: "failed" }),
              "Payment voided"
            )
          }
        >
          {busy ? "…" : "Void"}
        </button>
      </div>
    );
  }

  if (status !== "succeeded") return null;

  return (
    <button
      type="button"
      disabled={busy}
      className="btn-danger px-3 py-1.5 text-xs"
      onClick={() =>
        act(
          "Refund this payment? Card refunds go through Stripe.",
          () => refundPayment({ paymentId }),
          "Refund issued"
        )
      }
    >
      {busy ? "…" : "Refund"}
    </button>
  );
}
