"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminResolvePendingPayment, refundPayment } from "@/actions/payments";
import type { ActionResult, PaymentRow } from "@/types";

// Controls on one recorded job payment.
//
// Nothing here moves money — the platform never held any of it. Resolving a
// stuck claim records what actually happened between the customer and the
// professional; "mark refunded" records a refund THEY made directly.
//
// Desk support may resolve a PENDING claim; marking a settled payment refunded
// is admin-only, so that control is not rendered for them at all rather than
// failing on click.
export default function PaymentAdminActions({
  paymentId,
  status,
  isAdmin,
}: {
  paymentId: string;
  status: PaymentRow["status"];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() =>
            act(
              "Record this payment as received by the professional? The booking confirms if it was still awaiting confirmation.",
              () =>
                adminResolvePendingPayment({ paymentId, to: "succeeded" }),
              "Payment recorded"
            )
          }
        >
          {busy ? "…" : "Mark recorded"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-danger px-3 py-1.5 text-xs"
          onClick={() =>
            act(
              "Void this claim? Use when the money never actually changed hands.",
              () => adminResolvePendingPayment({ paymentId, to: "failed" }),
              "Claim voided"
            )
          }
        >
          {busy ? "…" : "Void"}
        </button>
      </div>
    );
  }

  if (status !== "succeeded" || !isAdmin) return null;

  return (
    <button
      type="button"
      disabled={busy}
      className="btn-danger px-3 py-1.5 text-xs"
      onClick={() =>
        act(
          "Mark this payment refunded? This is a RECORD only — CheersJA never held the money, so the professional must return it to the customer themselves.",
          () => refundPayment({ paymentId }),
          "Marked refunded"
        )
      }
    >
      {busy ? "…" : "Mark refunded"}
    </button>
  );
}
