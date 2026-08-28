"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { reviewIdentityVerification } from "@/actions/verification";

// Approve / decline buttons for a pending identity verification (customers
// and professionals both submit these). Rendered only for reviewers (admins +
// supervisors) and re-checked in the action. Approving grants the Verified ID
// badge; it unlocks nothing, because nothing is locked.
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
      if (
        !window.confirm(
          "Approve this ID? The account gets the Verified ID badge and the document is deleted."
        )
      )
        return;
    } else {
      const reason = window.prompt(
        "Why is this submission declined? (shown to the account holder)"
      );
      if (reason === null) return;
      note = reason.trim() || undefined;
    }
    setBusy(true);
    const res = await reviewIdentityVerification({
      verificationId,
      decision,
      note,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(
        decision === "approved" ? "Verified ID granted" : "Declined"
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn-primary py-1.5 text-xs"
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
