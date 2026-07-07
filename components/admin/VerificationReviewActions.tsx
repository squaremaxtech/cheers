"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { reviewCustomerVerification } from "@/actions/verification";

// Approve / reject buttons for a pending customer verification.
// Rendered only for reviewers (admins + supervisors).
export default function VerificationReviewActions({
  verificationId,
}: {
  verificationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    let note: string | undefined;
    if (decision === "approved") {
      if (!window.confirm("Approve this customer? Booking unlocks immediately."))
        return;
    } else {
      const reason = window.prompt(
        "Why is this submission declined? (shown to the customer)"
      );
      if (reason === null) return;
      note = reason.trim() || undefined;
    }
    setBusy(true);
    const res = await reviewCustomerVerification({
      verificationId,
      decision,
      note,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(decision === "approved" ? "Customer verified" : "Declined");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn-gold py-1.5 text-xs"
        disabled={busy}
        onClick={() => decide("approved")}
      >
        Approve
      </button>
      <button
        type="button"
        className="btn-outline py-1.5 text-xs"
        disabled={busy}
        onClick={() => decide("rejected")}
      >
        Decline
      </button>
    </div>
  );
}
