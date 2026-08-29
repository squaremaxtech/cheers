"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  adminMarkFeeInvoicePaid,
  adminRetryFeeInvoice,
  adminWaiveFeeInvoice,
} from "@/actions/payments";
import type { ActionResult, FeeInvoiceStatus } from "@/types";

// Admin controls on one professional's monthly commission statement. This
// replaced the old payout controls: money only ever comes IN now, so the
// levers are retry the charge, record an off-gateway settlement, or write it
// off. All three are audited.
export default function FeeInvoiceControls({
  invoiceId,
  status,
  paymentsLive,
}: {
  invoiceId: string;
  status: FeeInvoiceStatus;
  paymentsLive: boolean;
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

  const settled = status === "paid" || status === "waived";
  const chargeable = status === "due" || status === "failed";

  return (
    <div className="flex flex-wrap gap-2">
      {chargeable && paymentsLive && (
        <button
          type="button"
          disabled={busy}
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() =>
            act(
              "Charge this statement to the professional's card on file now?",
              () => adminRetryFeeInvoice({ invoiceId }),
              "Commission charged"
            )
          }
        >
          {busy ? "…" : "Charge now"}
        </button>
      )}
      {!settled && (
        <button
          type="button"
          disabled={busy}
          className="btn-outline px-3 py-1.5 text-xs"
          onClick={() =>
            act(
              "Mark this statement settled outside the gateway (cash, bank transfer)?",
              () => adminMarkFeeInvoicePaid({ invoiceId }),
              "Statement marked settled"
            )
          }
        >
          {busy ? "…" : "Mark settled"}
        </button>
      )}
      {status !== "waived" && (
        <button
          type="button"
          disabled={busy}
          className="btn-danger px-3 py-1.5 text-xs"
          onClick={() =>
            act(
              status === "paid"
                ? "Waive this statement? It was already charged, so the money is refunded to the card."
                : "Write off this commission? The professional will not be charged for it.",
              () => adminWaiveFeeInvoice({ invoiceId }),
              "Statement waived"
            )
          }
        >
          {busy ? "…" : "Waive"}
        </button>
      )}
    </div>
  );
}
